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

// Predefined time frames
const TIME_FRAMES = [
    { label: '1 Month', days: 30 },
    { label: '3 Months', days: 90 },
    { label: '6 Months', days: 180 },
    { label: '1 Year', days: 365 },
    { label: 'YTD', days: 'ytd' },
    { label: 'All Time', days: 'all' }
];

const StockCandlestickChart = ({
    ticker = 'F',
    width = "100%",
    height = "600px"
}) => {
    const chartRef = useRef(null);
    const [stockData, setStockData] = useState(null);
    const [timeFrame, setTimeFrame] = useState('6 Months');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch stock data
    useEffect(() => {
        const fetchStockData = async () => {
            setIsLoading(true);
            setError(null);

            const API_KEY = import.meta.env.VITE_POLYGON_API_KEY;

            try {
                // Determine date range based on selected time frame
                const now = new Date();
                let startDate, endDate;

                if (timeFrame === 'YTD') {
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = now;
                } else if (timeFrame === 'All Time') {
                    // Fetch data for the last 10 years
                    startDate = new Date(now.getFullYear() - 10, 0, 1);
                    endDate = now;
                } else {
                    // Find the selected time frame
                    const selectedFrame = TIME_FRAMES.find(frame => frame.label === timeFrame);
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - selectedFrame.days);
                    endDate = now;
                }

                // Format dates for API
                const formatDate = (date) =>
                    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                const response = await fetch(
                    `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${formatDate(startDate)}/${formatDate(endDate)}?apiKey=${API_KEY}`,
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

        fetchStockData();
    }, [ticker, timeFrame]);

    // Chart initialization
    useEffect(() => {
        // Ensure we have a chart ref and stock data
        if (!stockData || stockData.length === 0 || !chartRef.current) {
            return;
        }

        let sciChartSurface = null;

        const initializeChart = async () => {
            try {
                // Compute price ranges
                const prices = stockData.flatMap(day => [day.o, day.h, day.l, day.c]);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);

                // Initialize SciChart surface
                const { sciChartSurface: surface, wasmContext } = await SciChartSurface.create(chartRef.current);
                sciChartSurface = surface;

                // Configure X-Axis (DateTime)
                const xAxis = new DateTimeNumericAxis(wasmContext, {
                    visibleRange: new NumberRange(
                        stockData[0].t,
                        stockData[stockData.length - 1].t
                    )
                });

                // Modify x-axis label formatting
                xAxis.labelProvider.formatLabel = (unixTimestamp) => {
                    // Ensure the timestamp is converted to a number
                    const timestamp = Number(unixTimestamp);

                    // Find the closest data point to this timestamp
                    const closestDataPoint = stockData.reduce((prev, curr) =>
                        Math.abs(curr.t - timestamp) < Math.abs(prev.t - timestamp) ? curr : prev
                    );

                    // Format the date of the closest data point
                    const date = new Date(closestDataPoint.t);
                    return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
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

                // Populate data series with stock data
                stockData.forEach(day => {
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

                // Add interactivity modifiers
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
                        showAxisLabels: true
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
    }, [stockData, ticker]);

    return (
        <div style={{
            position: 'relative',
            width,
            height,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Time frame selector */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '10px',
                backgroundColor: '#f0f0f0'
            }}>
                {TIME_FRAMES.map((frame) => (
                    <button
                        key={frame.label}
                        onClick={() => setTimeFrame(frame.label)}
                        style={{
                            margin: '0 5px',
                            padding: '5px 10px',
                            backgroundColor: timeFrame === frame.label ? '#4CAF50' : 'white',
                            color: timeFrame === frame.label ? 'white' : 'black',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {frame.label}
                    </button>
                ))}
            </div>

            {/* Chart container */}
            <div
                ref={chartRef}
                style={{
                    width: '100%',
                    height: 'calc(100% - 50px)'
                }}
            />

            {/* Loading and Error States */}
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

export default StockCandlestickChart;