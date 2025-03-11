import React, { useState, useEffect } from 'react';
import {
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    Button,
    Typography
} from "@material-tailwind/react";

const StockGridVisualizer = ({ ticker = 'F', year = 2024 }) => {
    const [gridData, setGridData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dataStats, setDataStats] = useState({
        minPrice: 0,
        maxPrice: 0,
        totalDataPoints: 0,
        tradingDays: 0
    });

    // Use import.meta.env for Vite
    const API_KEY = import.meta.env.VITE_POLYGON_API_KEY;
    if (!API_KEY) {
        console.error('Polygon.io API key is missing!');
    }

    const fetchAndProcessData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Corrected date formatting
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
                const errorText = await response.text();
                throw new Error(`Failed to fetch stock data: ${errorText}`);
            }

            const data = await response.json();
            console.log(`Fetched ${data.results.length} data points`);

            // Process data into a 12×31 grid (months × days)
            const months = 12;
            const days = 31;
            const basePrice = 0; // Use 0 as placeholder for missing data

            // Initialize grid with base values
            const priceGrid = Array(months).fill().map(() => Array(days).fill(basePrice));

            // Fill grid with actual data
            let minPrice = Number.MAX_VALUE;
            let maxPrice = Number.MIN_VALUE;

            data.results.forEach(dayData => {
                const date = new Date(dayData.t);
                const month = date.getMonth(); // 0-11
                const day = date.getDate() - 1; // 0-30

                // Store closing price in grid
                priceGrid[month][day] = dayData.c;

                // Track min/max prices
                minPrice = Math.min(minPrice, dayData.c);
                maxPrice = Math.max(maxPrice, dayData.c);
            });

            // Fill in missing values within months
            for (let m = 0; m < months; m++) {
                let lastKnownPrice = null;

                // Forward fill - use previous known price
                for (let d = 0; d < days; d++) {
                    if (priceGrid[m][d] !== basePrice) {
                        lastKnownPrice = priceGrid[m][d];
                    } else if (lastKnownPrice !== null) {
                        priceGrid[m][d] = lastKnownPrice;
                    }
                }

                // Backward fill - for start of month
                lastKnownPrice = null;
                for (let d = days - 1; d >= 0; d--) {
                    if (priceGrid[m][d] !== basePrice) {
                        lastKnownPrice = priceGrid[m][d];
                    } else if (lastKnownPrice !== null && priceGrid[m][d] === basePrice) {
                        priceGrid[m][d] = lastKnownPrice;
                    }
                }
            }

            // Fill in completely empty months by copying from nearest month with data
            for (let m = 0; m < months; m++) {
                // Check if month has any real data
                let hasData = priceGrid[m].some(price => price !== basePrice);

                if (!hasData) {
                    let nearestMonth = -1;
                    let minDistance = months;

                    // Find nearest month with data
                    for (let mm = 0; mm < months; mm++) {
                        if (mm === m) continue;

                        if (priceGrid[mm].some(price => price !== basePrice)) {
                            const distance = Math.abs(mm - m);
                            if (distance < minDistance) {
                                minDistance = distance;
                                nearestMonth = mm;
                            }
                        }
                    }

                    // Copy from nearest month if found
                    if (nearestMonth !== -1) {
                        for (let d = 0; d < days; d++) {
                            priceGrid[m][d] = priceGrid[nearestMonth][d];
                        }
                    }
                }
            }

            // Final calculation of min/max across entire grid
            for (let m = 0; m < months; m++) {
                for (let d = 0; d < days; d++) {
                    if (priceGrid[m][d] !== basePrice) {
                        minPrice = Math.min(minPrice, priceGrid[m][d]);
                        maxPrice = Math.max(maxPrice, priceGrid[m][d]);
                    }
                }
            }

            // Ensure we have valid min/max
            if (!isFinite(minPrice) || !isFinite(maxPrice)) {
                minPrice = 0;
                maxPrice = 1000;
            }

            // Count actual trading days
            const tradingDays = data.results.length;

            // Set state with processed data
            setGridData(priceGrid);
            setDataStats({
                minPrice,
                maxPrice,
                totalDataPoints: months * days,
                tradingDays
            });

        } catch (err) {
            setError(err.message);
            console.error('Error processing stock data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!API_KEY) return;
        fetchAndProcessData();
    }, [ticker, year, API_KEY]);

    // Helper function to get color for cell based on price value
    const getPriceColor = (price) => {
        if (price === 0) return 'bg-gray-200'; // Missing data

        const range = dataStats.maxPrice - dataStats.minPrice;
        if (range === 0) return 'bg-blue-500';

        // Normalize price between 0 and 1
        const normalized = (price - dataStats.minPrice) / range;

        // Create color gradient from white to dark blue
        const intensity = Math.floor(255 * (1 - normalized));

        return `rgb(${intensity}, ${intensity}, 255)`;
    };

    // Render key missing state
    if (!API_KEY) {
        return (
            <Card className="mt-6 w-96">
                <CardBody>
                    <Typography variant="h5" color="red" className="mb-2">
                        Error: API Key Missing
                    </Typography>
                    <Typography>
                        Please set VITE_POLYGON_API_KEY in your .env file.
                    </Typography>
                </CardBody>
            </Card>
        );
    }

    // Render loading state
    if (isLoading) {
        return (
            <Card className="mt-6 w-96">
                <CardBody>
                    <Typography>Loading stock data grid...</Typography>
                </CardBody>
            </Card>
        );
    }

    // Render error state
    if (error) {
        return (
            <Card className="mt-6 w-96">
                <CardBody>
                    <Typography color="red">Error: {error}</Typography>
                </CardBody>
            </Card>
        );
    }

    // Generate month names
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Render stock data grid
    return (
        <Card className="mt-6 w-full max-w-6xl">
            <CardHeader color="blue" className="relative h-24">
                <Typography variant="h4" color="white" className="mt-4 ml-4">
                    {ticker} Stock Data Grid for {year}
                </Typography>
            </CardHeader>
            <CardBody>
                <div className="mb-4 flex justify-between">
                    <div>
                        <Typography variant="h6">Data Statistics:</Typography>
                        <Typography>Trading Days: {dataStats.tradingDays} of {dataStats.totalDataPoints} possible days</Typography>
                        <Typography>Price Range: ${dataStats.minPrice.toFixed(2)} to ${dataStats.maxPrice.toFixed(2)}</Typography>
                    </div>
                    <div className="flex items-center">
                        <div className="w-32 h-6 bg-gradient-to-r from-white to-blue-700 mr-2"></div>
                        <Typography className="text-xs">
                            ${dataStats.minPrice.toFixed(2)} → ${dataStats.maxPrice.toFixed(2)}
                        </Typography>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'auto repeat(31, minmax(30px, 1fr))', gap: '1px' }}>
                        {/* Header row with day numbers */}
                        <div className="grid-header" style={{ fontWeight: 'bold', textAlign: 'center', padding: '4px' }}>
                            Month/Day
                        </div>
                        {[...Array(31)].map((_, index) => (
                            <div key={`day-${index}`} className="grid-header" style={{ fontWeight: 'bold', textAlign: 'center', padding: '4px' }}>
                                {index + 1}
                            </div>
                        ))}

                        {/* Grid data */}
                        {gridData.map((month, monthIndex) => (
                            <React.Fragment key={`month-${monthIndex}`}>
                                {/* Month name in first column */}
                                <div className="grid-month" style={{ fontWeight: 'bold', padding: '4px' }}>
                                    {monthNames[monthIndex]}
                                </div>

                                {/* Days in the month */}
                                {month.map((price, dayIndex) => {
                                    const style = {
                                        backgroundColor: getPriceColor(price),
                                        textAlign: 'center',
                                        padding: '4px',
                                        height: '30px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem'
                                    };

                                    return (
                                        <div
                                            key={`cell-${monthIndex}-${dayIndex}`}
                                            style={style}
                                            title={`${monthNames[monthIndex]} ${dayIndex + 1}: $${price.toFixed(2)}`}
                                        >
                                            {price !== 0 ? price.toFixed(0) : '-'}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </CardBody>
            <CardFooter>
                <Button
                    onClick={fetchAndProcessData}
                    disabled={isLoading}
                >
                    Refresh Data
                </Button>
            </CardFooter>
        </Card>
    );
};

export default StockGridVisualizer;