// FinanceCard.js
import { React, useState, useRef, useEffect } from "react";
import {
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    Button
} from "@material-tailwind/react";
import { Bars3Icon } from "@heroicons/react/24/outline";
import TerrainShader from "./terrain";
import StockCandlestickChart from "./CandlestickChart";

const models = [
    {
        modelName: "Apple Stock",
        symbol: "AAPL",
        basePrice: 170
    },
    {
        modelName: "Microsoft Stock",
        symbol: "MSFT",
        basePrice: 320
    },
    {
        modelName: "Google Stock",
        symbol: "GOOGL",
        basePrice: 140
    },
    {
        modelName: "Amazon Stock",
        symbol: "AMZN",
        basePrice: 130
    }
];

export default function FinanceCard({ defaultModelIndex = 0 }) {
    const [selectedModelIndex, setSelectedModelIndex] = useState(defaultModelIndex);
    const { modelName, symbol, basePrice } = models[selectedModelIndex];
    const [hoverData, setHoverData] = useState(null);
    const [terrainKey, setTerrainKey] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        }

        if (menuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuOpen]);

    return (
        <Card className="bg-gradient-to-b from-gray-800 to-gray-600 w-auto mx-auto">
            <CardHeader
                floated={false}
                className="relative h-auto py-4 bg-white"
            >
                <div className="flex items-center justify-between px-4">
                    <div className="flex flex-col gap-1">
                        <span className="font-poppins text-lg">{modelName}</span>
                        {hoverData ? (
                            <div className="flex flex-col text-sm space-y-0.5 text-gray-700">
                                <div className="flex gap-4">
                                    <span>Symbol: {symbol}</span>
                                </div>
                                <div className="flex gap-4">
                                    <span>Day: {hoverData.day}</span>
                                    <span>Month: {hoverData.month}</span>
                                </div>
                                <div className="flex gap-4">
                                    <span>Price: ${hoverData.price}</span>
                                    <span>Height: {hoverData.rawHeight}%</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-sm text-gray-600">Hover over terrain for data</span>
                        )}
                    </div>

                    {/* Button and container for dropdown */}
                    <div style={{ position: 'relative' }}>
                        <Button
                            color="white"
                            size="sm"
                            onClick={() => setMenuOpen(!menuOpen)}
                            ref={buttonRef}
                        >
                            <Bars3Icon className="w-6 h-6" />
                        </Button>

                        {/* Portal the dropdown menu to the body to avoid positioning issues */}
                        {menuOpen && (
                            <div
                                ref={menuRef}
                                style={{
                                    position: 'fixed', // Use fixed positioning
                                    zIndex: 99999,
                                    backgroundColor: 'white',
                                    borderRadius: '0.375rem',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    padding: '0.5rem',
                                    border: '1px solid #e5e7eb',
                                    width: '180px',
                                    // Calculate position based on button position
                                    top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + 5 : 0,
                                    left: buttonRef.current ? buttonRef.current.getBoundingClientRect().right - 180 : 0,
                                }}
                            >
                                {models.map((model, index) => (
                                    <div
                                        key={index}
                                        onClick={() => {
                                            setSelectedModelIndex(index);
                                            setTerrainKey(prevKey => prevKey + 1);
                                            setMenuOpen(false);
                                        }}
                                        style={{
                                            padding: '0.5rem 0.75rem',
                                            cursor: 'pointer',
                                            borderRadius: '0.25rem',
                                            backgroundColor: selectedModelIndex === index ? '#f3f4f6' : 'transparent',
                                            color: '#374151',
                                            margin: '0.25rem 0',
                                            fontWeight: selectedModelIndex === index ? 'bold' : 'normal'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = selectedModelIndex === index ? '#f3f4f6' : 'transparent'}
                                    >
                                        {model.modelName}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardBody className="p-0 h-[550px]">
                <StockCandlestickChart
                />
            </CardBody>

            <CardFooter className="flex flex-col gap-4 pt-4">
                <p className="text-white text-sm text-center">
                    3D Visualization - {symbol}
                </p>
            </CardFooter>
        </Card>
    );
}