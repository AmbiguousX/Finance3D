import React, { useState, useEffect } from "react";
import {
    CameraController,
    EDrawMeshAs,
    GradientColorPalette,
    HeatmapLegend,
    MouseWheelZoomModifier3D,
    NumberRange,
    NumericAxis3D,
    OrbitModifier3D,
    ResetCamera3DModifier,
    SciChart3DSurface,
    SurfaceMeshRenderableSeries3D,
    TooltipModifier3D,
    UniformGridDataSeries3D,
    Vector3,
    zeroArray2D,
    SciChartSurface
} from "scichart";

// Renamed component to SurfaceChart as requested
const SurfaceChart = ({ ticker = "AAPL", year = 2024 }) => {
    // State for chart elements and data
    const [chartDiv, setChartDiv] = useState(null);
    const [legendDiv, setLegendDiv] = useState(null);
    const [mainChart, setMainChart] = useState(null);
    const [legendChart, setLegendChart] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Initialize community license once
    useEffect(() => {
        SciChartSurface.UseCommunityLicense();
    }, []);

    // Second step: Initialize chart 
    useEffect(() => {
        // Only proceed if DOM elements exist
        if (!chartDiv || !legendDiv) {
            return;
        }

        console.log("Initializing chart");
        setIsLoading(true);

        const initCharts = async () => {
            try {
                // Create main chart
                const { sciChart3DSurface, wasmContext } = await SciChart3DSurface.create(chartDiv);

                // Set camera for better viewing
                sciChart3DSurface.camera = new CameraController(wasmContext, {
                    position: new Vector3(-150, 150, 150),
                    target: new Vector3(15, 50, 6),
                });

                // Set world dimensions and background
                sciChart3DSurface.worldDimensions = new Vector3(200, 100, 200);
                sciChart3DSurface.background = "Transparent";

                // Create axes with financial labels
                sciChart3DSurface.xAxis = new NumericAxis3D(wasmContext, {
                    axisTitle: "Day of Month",
                    visibleRange: new NumberRange(1, 31)
                });

                sciChart3DSurface.yAxis = new NumericAxis3D(wasmContext, {
                    axisTitle: "Price ($)",
                    visibleRange: new NumberRange(100, 1000)
                });

                sciChart3DSurface.zAxis = new NumericAxis3D(wasmContext, {
                    axisTitle: "Month",
                    visibleRange: new NumberRange(1, 12)
                });

                // Fixed parameters for the data grid
                const days = 31;
                const months = 12;
                const basePrice = 500; // Default price

                // Create a uniform grid for synthetic price data
                const priceData = zeroArray2D([months, days]);

                // Generate synthetic data with complex wave patterns
                for (let m = 0; m < months; m++) {
                    for (let d = 0; d < days; d++) {
                        const x = d / days;
                        const y = m / months;

                        // More complex synthetic data generation
                        priceData[m][d] = basePrice +
                            100 * Math.sin(x * Math.PI * 2) +  // Day-based variation
                            50 * Math.sin(y * Math.PI * 4) +   // Month-based variation
                            25 * Math.sin(x * y * Math.PI) +   // Interaction between day and month
                            Math.random() * 20 - 10;           // Random noise
                    }
                }

                // Find min/max for scaling
                let minPrice = Math.min(...priceData.flat());
                let maxPrice = Math.max(...priceData.flat());

                // Ensure sufficient range
                if (maxPrice - minPrice < 10) {
                    maxPrice = minPrice + 100;
                }

                console.log(`Synthetic Price range: $${minPrice.toFixed(2)} to $${maxPrice.toFixed(2)}`);

                // Update Y axis range to match the data
                sciChart3DSurface.yAxis.visibleRange = new NumberRange(minPrice * 0.9, maxPrice * 1.1);

                // Create data series
                const dataSeries = new UniformGridDataSeries3D(wasmContext, {
                    yValues: priceData,
                    xStep: 1, // 1 day per step
                    zStep: 1, // 1 month per step
                    dataSeriesName: `${ticker} Synthetic Price Surface`,
                    xStart: 1, // Start at day 1
                    zStart: 1 // Start at month 1
                });

                // Use the working colors
                const colorMap = new GradientColorPalette(wasmContext, {
                    gradientStops: [
                        { offset: 1, color: "#FFFFFF" }, // White
                        { offset: 0.75, color: "#CCCCCC" }, // Light gray
                        { offset: 0.5, color: "#999999" }, // Medium gray
                        { offset: 0.25, color: "#555555" }, // Dark gray
                        { offset: 0, color: "#000000" }, // Black
                    ],
                });

                // Create surface series with financial styling
                const series = new SurfaceMeshRenderableSeries3D(wasmContext, {
                    dataSeries,
                    minimum: minPrice,
                    maximum: maxPrice,
                    opacity: 0.9,
                    cellHardnessFactor: 1.0,
                    shininess: 30,
                    lightingFactor: 0.6,
                    highlight: 1.0,
                    stroke: "#444444",
                    strokeThickness: 1.0,
                    contourStroke: "#FFFFFF",
                    contourInterval: 50, // $50 intervals
                    contourOffset: 0,
                    contourStrokeThickness: 1,
                    drawSkirt: false,
                    drawMeshAs: EDrawMeshAs.SOLID_WIREFRAME,
                    meshColorPalette: colorMap
                });

                sciChart3DSurface.renderableSeries.add(series);

                // Add modifiers for interaction
                sciChart3DSurface.chartModifiers.add(new MouseWheelZoomModifier3D());
                sciChart3DSurface.chartModifiers.add(new OrbitModifier3D());
                sciChart3DSurface.chartModifiers.add(new OrbitModifier3D()); // Keep the duplicate as in your working code
                sciChart3DSurface.chartModifiers.add(new ResetCamera3DModifier());
                sciChart3DSurface.chartModifiers.add(new TooltipModifier3D({
                    tooltipContainerBackground: "#333333"
                }));

                // Store chart reference
                setMainChart(sciChart3DSurface);

                // Create legend with the working color configuration
                try {
                    const { heatmapLegend } = await HeatmapLegend.create(legendDiv, {
                        colorMap: {
                            minimum: minPrice,
                            maximum: maxPrice,
                            gradientStops: [
                                { offset: 1, color: "#FFFFFF" }, // White
                                { offset: 0.75, color: "#CCCCCC" }, // Light gray
                                { offset: 0.5, color: "#999999" }, // Medium gray
                                { offset: 0.25, color: "#555555" }, // Dark gray
                                { offset: 0, color: "#000000" }, // Black
                            ],
                            background: "Transparent"
                        }
                    });

                    // Store legend reference
                    setLegendChart(heatmapLegend);
                } catch (err) {
                    console.warn("Non-critical error creating legend:", err);
                }

                console.log("Chart initialized successfully");
                setIsLoading(false);
            } catch (initError) {
                console.error("Error initializing chart:", initError);
                setError("Chart initialization error: " + initError.message);
                setIsLoading(false);
            }
        };

        initCharts();

        // Cleanup function
        return () => {
            if (mainChart) {
                try {
                    mainChart.delete();
                } catch (e) {
                    console.warn("Error cleaning up main chart:", e);
                }
            }
            if (legendChart) {
                try {
                    legendChart.delete();
                } catch (e) {
                    console.warn("Error cleaning up legend chart:", e);
                }
            }
        };
    }, [chartDiv, legendDiv, ticker, year]);

    return (
        <div style={{ position: "relative", width: "100%", height: "550px" }}>
            <div
                ref={setChartDiv}
                style={{ height: "100%", width: "100%" }}
            />
            <div
                ref={setLegendDiv}
                style={{
                    position: "absolute",
                    height: "100%",
                    width: "65px",
                    top: "0px",
                    right: "0px",
                }}
            />
            {isLoading && (
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "rgba(0,0,0,0.5)",
                    color: "white",
                    zIndex: 10
                }}>
                    <div className="text-center">
                        <div className="mb-2">Loading {ticker} synthetic data...</div>
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                </div>
            )}
            {error && (
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: 0,
                    right: 0,
                    padding: "10px",
                    backgroundColor: "rgba(255, 0, 0, 0.7)",
                    color: "white",
                    textAlign: "center",
                    transform: "translateY(-50%)",
                    zIndex: 10
                }}>
                    {error}
                </div>
            )}
        </div>
    );
};

export default SurfaceChart;