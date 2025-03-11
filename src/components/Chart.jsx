import React, { useState, useEffect, useRef } from 'react';
import {
    SciChartSurface,
    DateTimeNumericAxis,
    NumericAxis,
    OhlcDataSeries,
    FastCandlestickRenderableSeries,
    FastLineRenderableSeries,
    XyMovingAverageFilter,
    ZoomExtentsModifier,
    ZoomPanModifier,
    MouseWheelZoomModifier,
    CursorModifier,
    ENumericFormat,
    NumberRange
} from 'scichart';

const FinanceChart = ({
    ticker = 'AAPL',
    year = 2024,
    width = "100%",
    height = "600px"
}) => {
    const chartRef = useRef(null);
    const [stockData, setStockData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchYearlyStockData = async () => {
            setIsLoading(true);
            setError(null);

            const API_KEY = import.meta.env.VITE_POLYGON_API_KEY;

            try {
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;

                const response = await fetch(
                    `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${startDate}/${endDate}?apiKey=${API_KEY}`,
                    {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                if (!data.results || data.results.length === 0) {
                    throw new Error(`No data available for ${ticker}`);
                }

                // Sort data by timestamp to ensure chronological order
                const sortedData = [...data.results].sort((a, b) => a.t - b.t);
                setStockData(sortedData);
            } catch (err) {
                console.error('Error fetching stock data:', err);
                setError(`Data fetch error: ${err.message}`);
                setStockData([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchYearlyStockData();
    }, [ticker, year]);

    useEffect(() => {
        // Ensure we have a chart ref and stock data
        if (!stockData || stockData.length === 0 || !chartRef.current) {
            return;
        }

        let sciChartSurface = null;

        const initializeChart = async () => {
            try {
                // Filter and sort data to ensure we're only getting the specified year
                const filteredData = stockData.filter(day => {
                    const date = new Date(day.t);
                    return date.getFullYear() === year;
                });

                if (filteredData.length === 0) {
                    throw new Error(`No data available for ${ticker} in ${year}`);
                }

                // Compute price ranges
                const prices = filteredData.flatMap(day => [day.o, day.h, day.l, day.c]);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);

                // Initialize SciChart surface
                const { sciChartSurface: surface, wasmContext } = await SciChartSurface.create(chartRef.current);
                sciChartSurface = surface;

                // Configure X-Axis (DateTime)
                const xAxis = new DateTimeNumericAxis(wasmContext, {
                    visibleRange: new NumberRange(
                        filteredData[0].t,
                        filteredData[filteredData.length - 1].t
                    )
                });

                // Modify x-axis label formatting
                xAxis.labelProvider.formatLabel = (unixTimestamp) => {
                    const date = new Date(unixTimestamp);
                    return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                    });
                };
                sciChartSurface.xAxes.add(xAxis);

                // Configure Y-Axis
                const yAxis = new NumericAxis(wasmContext, {
                    visibleRange: new NumberRange(minPrice * 0.9, maxPrice * 1.1),
                    growBy: new NumberRange(0.1, 0.1),
                    labelFormat: ENumericFormat.Decimal,
                    labelPrecision: 2,
                    labelPrefix: "$"
                });
                sciChartSurface.yAxes.add(yAxis);

                // Create OHLC Data Series
                const candleDataSeries = new OhlcDataSeries(wasmContext, {
                    dataSeriesName: `${ticker} Candlestick`
                });

                // Populate data series with filtered stock data
                filteredData.forEach(day => {
                    candleDataSeries.append(
                        day.t,   // timestamp
                        day.o,   // open
                        day.h,   // high
                        day.l,   // low
                        day.c    // close
                    );
                });

                // Create Candlestick Series
                const candlestickSeries = new FastCandlestickRenderableSeries(wasmContext, {
                    dataSeries: candleDataSeries,
                    strokeThickness: 1,
                    brushUp: "rgba(0, 255, 0, 0.5)",
                    brushDown: "rgba(255, 0, 0, 0.5)",
                    strokeUp: "green",
                    strokeDown: "red"
                });
                sciChartSurface.renderableSeries.add(candlestickSeries);

                // Add Moving Averages
                sciChartSurface.renderableSeries.add(
                    new FastLineRenderableSeries(wasmContext, {
                        dataSeries: new XyMovingAverageFilter(candleDataSeries, {
                            dataSeriesName: "Moving Average (20)",
                            length: 20
                        }),
                        stroke: "skyblue"
                    })
                );

                sciChartSurface.renderableSeries.add(
                    new FastLineRenderableSeries(wasmContext, {
                        dataSeries: new XyMovingAverageFilter(candleDataSeries, {
                            dataSeriesName: "Moving Average (50)",
                            length: 50
                        }),
                        stroke: "pink"
                    })
                );

                // Add interactivity modifiers with custom tooltip
                sciChartSurface.chartModifiers.add(
                    new ZoomExtentsModifier(),
                    new ZoomPanModifier(),
                    new MouseWheelZoomModifier(),
                    new CursorModifier({
                        crosshairStroke: "limegreen",
                        axisLabelFill: "limegreen",
                        tooltipContainerBackground: "#222",
                        tooltipTextColor: "white",
                        showTooltip: true,
                        showAxisLabels: true,
                        tooltipDataTemplate: (seriesData) => {
                            if (!seriesData || seriesData.length === 0) return "No data";

                            // Find the OHLC series data point
                            const ohlcData = seriesData.find(series =>
                                series.dataSeries &&
                                series.dataSeries.dataSeriesName &&
                                series.dataSeries.dataSeriesName.includes("Candlestick")
                            );

                            if (!ohlcData) return "No OHLC data";

                            const dataPoint = ohlcData.dataPoint;
                            const date = new Date(dataPoint.xValue);

                            return `
                                <div style="color: white; font-family: Arial, sans-serif;">
                                    <strong>${date.toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            })}</strong><br>
                                    Open: $${dataPoint.open ? dataPoint.open.toFixed(2) : 'N/A'}<br>
                                    High: $${dataPoint.high ? dataPoint.high.toFixed(2) : 'N/A'}<br>
                                    Low: $${dataPoint.low ? dataPoint.low.toFixed(2) : 'N/A'}<br>
                                    Close: $${dataPoint.close ? dataPoint.close.toFixed(2) : 'N/A'}
                                </div>
                            `;
                        }
                    })
                );

                // Perform initial zoom to fit
                sciChartSurface.zoomExtents();

                return sciChartSurface;
            } catch (err) {
                console.error('Chart initialization error:', err);
                setError(`Chart initialization error: ${err.message}`);
                return null;
            }
        };

        let surfacePromise = initializeChart();

        // Cleanup function
        return () => {
            if (sciChartSurface) {
                try {
                    sciChartSurface.delete();
                } catch (error) {
                    console.warn('Error during chart cleanup:', error);
                }
            }
        };
    }, [stockData, ticker, year]);

    return (
        <div style={{ position: 'relative', width, height }}>
            <div
                ref={chartRef}
                style={{ width: '100%', height: '100%' }}
            />
            {isLoading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    zIndex: 10
                }}>
                    Loading {ticker} stock data...
                </div>
            )}
            {error && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '8px',
                    backgroundColor: 'rgba(255,0,0,0.7)',
                    color: 'white',
                    textAlign: 'center',
                    zIndex: 10
                }}>
                    {error}
                </div>
            )}
        </div>
    );
};

export default FinanceChart;