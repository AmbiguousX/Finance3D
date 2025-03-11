import React, { useState, useEffect } from 'react';
import {
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    Button,
    Typography
} from "@material-tailwind/react";

const StockDataFetcher = ({ ticker = 'AAPL', year = 2024 }) => {
    const [yearlyData, setYearlyData] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dataStats, setDataStats] = useState({
        totalDays: 0,
        tradingDays: 0
    });

    // Use import.meta.env for Vite
    const API_KEY = import.meta.env.VITE_POLYGON_API_KEY;
    if (!API_KEY) {
        console.error('Polygon.io API key is missing!');
    }

    const fetchYearlyStockData = async () => {
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
                throw new Error(`Failed to fetch yearly stock data: ${errorText}`);
            }

            const data = await response.json();

            // Organize data by date
            const yearData = {};

            data.results.forEach(dayData => {
                const date = new Date(dayData.t);
                const formattedDate = date.toISOString().split('T')[0];

                yearData[formattedDate] = {
                    date: formattedDate,
                    open: dayData.o,
                    high: dayData.h,
                    low: dayData.l,
                    close: dayData.c,
                    volume: dayData.v
                };
            });

            setYearlyData(yearData);

            // Calculate data statistics
            setDataStats({
                totalDays: Object.keys(yearData).length,
                tradingDays: Object.keys(yearData).length
            });

        } catch (err) {
            setError(err.message);
            console.error('Error fetching yearly stock data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!API_KEY) return;
        fetchYearlyStockData();
    }, [ticker, year, API_KEY]);

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
                    <Typography>Loading stock data...</Typography>
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

    // Render stock data
    return (
        <Card className="mt-6 w-full max-w-4xl">
            <CardHeader color="blue" className="relative h-24">
                <Typography variant="h4" color="white" className="mt-4 ml-4">
                    {ticker} Stock Data for {year}
                </Typography>
            </CardHeader>
            <CardBody>
                <div className="mb-4">
                    <Typography>
                        Trading Days: {dataStats.tradingDays}
                    </Typography>
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-scroll">
                    <table className="w-full table-auto text-left">
                        <thead className="sticky top-0 bg-blue-gray-50">
                            <tr>
                                <th className="p-4 border-b border-blue-gray-100">Date</th>
                                <th className="p-4 border-b border-blue-gray-100">Open</th>
                                <th className="p-4 border-b border-blue-gray-100">High</th>
                                <th className="p-4 border-b border-blue-gray-100">Low</th>
                                <th className="p-4 border-b border-blue-gray-100">Close</th>
                                <th className="p-4 border-b border-blue-gray-100">Volume</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.values(yearlyData).map((dayData) => (
                                <tr key={dayData.date} className="hover:bg-blue-gray-50">
                                    <td className="p-4 border-b border-blue-gray-50">{dayData.date}</td>
                                    <td className="p-4 border-b border-blue-gray-50">${dayData.open.toFixed(2)}</td>
                                    <td className="p-4 border-b border-blue-gray-50">${dayData.high.toFixed(2)}</td>
                                    <td className="p-4 border-b border-blue-gray-50">${dayData.low.toFixed(2)}</td>
                                    <td className="p-4 border-b border-blue-gray-50">${dayData.close.toFixed(2)}</td>
                                    <td className="p-4 border-b border-blue-gray-50">{dayData.volume.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardBody>
            <CardFooter>
                <Button
                    onClick={fetchYearlyStockData}
                    disabled={isLoading}
                >
                    Refresh Data
                </Button>
            </CardFooter>
        </Card>
    );
};

export default StockDataFetcher;