import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const TerrainShader = ({ onHoverData, symbol = "AAPL", basePrice = 170, year = 2024 }) => {
    // Constants
    const HEIGHT_SCALE = 15;
    const GRID_DAYS = 31;
    const GRID_MONTHS = 12;
    const CANVAS_HEIGHT = 550;
    const MIN_CAMERA_DISTANCE = 30;
    const MAX_CAMERA_DISTANCE = 150;
    const INITIAL_CAMERA_DISTANCE = 50;
    const INITIAL_CAMERA_ELEVATION = 45;
    const X_SCALE_FACTOR = 2.5; // Scale X (month axis) to make square with 12 months vs 31 days

    // Mobile specific constants
    const MOBILE_MAX_CAMERA_DISTANCE = 180;
    const MOBILE_INITIAL_CAMERA_DISTANCE = 100;

    // State for stock data
    const [stockData, setStockData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Refs and other existing references
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const terrainRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const pointerRef = useRef(new THREE.Vector2());
    const helperRef = useRef(null);
    const controlsRef = useRef(null);

    // Last hover data ref
    const lastHitRef = useRef({
        day: '15',
        price: basePrice.toFixed(2),
        month: '6',
        rawHeight: "50.0"
    });

    // Fetch stock data
    useEffect(() => {
        const fetchStockData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const API_KEY = import.meta.env.VITE_POLYGON_API_KEY;

                if (!API_KEY) {
                    throw new Error("No Polygon.io API key found. Please set VITE_POLYGON_API_KEY in your .env file.");
                }

                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;

                const response = await fetch(
                    `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${startDate}/${endDate}?apiKey=${API_KEY}`,
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
                    throw new Error(`No stock data found for ${symbol} in ${year}`);
                }

                // Sort data by timestamp to ensure chronological order
                const sortedData = data.results.sort((a, b) => a.t - b.t);

                setStockData(sortedData);
                setIsLoading(false);
            } catch (err) {
                console.error("Error fetching stock data:", err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        fetchStockData();
    }, [symbol, year]);

    // Mobile detection
    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    };

    // Helper function to create axis labels
    const createAxisLabel = (text, position, color = 'white') => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        context.fillStyle = color;
        context.font = 'bold 36px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.scale.set(10, 2.5, 1);
        return sprite;
    };

    // Add axes to the scene
    const addAxes = (scene, minPrice, maxPrice) => {
        // Months axis (X) - scale to match terrain scaling
        const monthsLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(GRID_MONTHS * X_SCALE_FACTOR, 0, 0)
            ]),
            new THREE.LineBasicMaterial({ color: 0xffffff })
        );
        scene.add(monthsLine);
        scene.add(createAxisLabel('Months', new THREE.Vector3(GRID_MONTHS * X_SCALE_FACTOR / 2, -1, 0)));

        // Days axis (Z)
        const daysLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, GRID_DAYS)
            ]),
            new THREE.LineBasicMaterial({ color: 0xffffff })
        );
        scene.add(daysLine);
        scene.add(createAxisLabel('Days', new THREE.Vector3(0, -1, GRID_DAYS / 2)));

        // Price axis (Y)
        const priceLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, HEIGHT_SCALE, 0)
            ]),
            new THREE.LineBasicMaterial({ color: 0xffffff })
        );
        scene.add(priceLine);
        scene.add(createAxisLabel('Price', new THREE.Vector3(0, HEIGHT_SCALE / 2, 0)));

        // Price labels
        scene.add(createAxisLabel(`$${minPrice.toFixed(0)}`, new THREE.Vector3(0, 0, 0), 'lightgray'));
        scene.add(createAxisLabel(`$${maxPrice.toFixed(0)}`, new THREE.Vector3(0, HEIGHT_SCALE, 0), 'lightgray'));

        // Month and day tick marks
        for (let i = 0; i <= 5; i++) {
            // Month ticks - account for X scaling
            if (i * 2 < GRID_MONTHS) {
                scene.add(createAxisLabel(
                    Math.round(i * 2 + 1).toString(), // +1 for 1-based months
                    new THREE.Vector3(i * 2 * X_SCALE_FACTOR, -1, -1),
                    'lightgray'
                ));
            }

            // Day ticks - no scaling
            if (i * 6 < GRID_DAYS) {
                scene.add(createAxisLabel(
                    Math.round(i * 6 + 1).toString(), // +1 for 1-based days
                    new THREE.Vector3(-1, -1, i * 6),
                    'lightgray'
                ));
            }
        }
    };

    // Scene setup
    const setupScene = () => {
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        return scene;
    };

    // Camera setup
    const setupCamera = (width) => {
        const camera = new THREE.PerspectiveCamera(45, width / CANVAS_HEIGHT, 0.1, 1000);
        const isMobile = isMobileDevice();
        const initialDistance = isMobile ? MOBILE_INITIAL_CAMERA_DISTANCE : INITIAL_CAMERA_DISTANCE;

        // Adjust camera for scaled terrain
        camera.position.set(
            GRID_MONTHS * X_SCALE_FACTOR / 2,
            GRID_DAYS / 2,
            initialDistance
        );
        // Look at center of scaled terrain
        camera.lookAt(GRID_MONTHS * X_SCALE_FACTOR / 2, 0, GRID_DAYS / 2);
        cameraRef.current = camera;
        return camera;
    };

    // Renderer setup
    const setupRenderer = (width) => {
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

        const isMobile = isMobileDevice();
        const renderWidth = isMobile ? width * 0.85 : width;

        renderer.setSize(renderWidth, CANVAS_HEIGHT);
        canvasRef.current.innerHTML = '';

        const rendererElement = renderer.domElement;
        if (isMobile) {
            rendererElement.style.margin = '0 auto';
        }

        canvasRef.current.appendChild(rendererElement);
        rendererRef.current = renderer;
        return renderer;
    };

    // Helper point creation
    const createHelper = (scene) => {
        const geometryHelper = new THREE.SphereGeometry(0.3, 16, 16);
        const helper = new THREE.Mesh(
            geometryHelper,
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.8
            })
        );
        helperRef.current = helper;
        scene.add(helper);
        helper.visible = false;
        return { helper, geometryHelper };
    };

    // Controls setup
    const setupControls = (camera, renderer) => {
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = MIN_CAMERA_DISTANCE;

        const isMobile = isMobileDevice();
        controls.maxDistance = isMobile ? MOBILE_MAX_CAMERA_DISTANCE : MAX_CAMERA_DISTANCE;

        controls.maxPolarAngle = Math.PI / 2;
        // Target center of scaled terrain
        controls.target.set(GRID_MONTHS * X_SCALE_FACTOR / 2, 0, GRID_DAYS / 2);
        controls.update();
        controlsRef.current = controls;
        return controls;
    };

    // Main rendering effect
    useEffect(() => {
        // Skip rendering if data is not ready
        if (!canvasRef.current || isLoading || error || stockData.length === 0) {
            return;
        }

        // Create a 2D array to store prices for each day and month
        const priceGrid = Array.from({ length: GRID_MONTHS }, () =>
            Array(GRID_DAYS).fill(basePrice)
        );

        // Populate the price grid with available stock data
        stockData.forEach(dayData => {
            const date = new Date(dayData.t);
            const month = date.getMonth();
            const day = date.getDate() - 1; // Adjust for 0-based index

            if (month >= 0 && month < GRID_MONTHS && day >= 0 && day < GRID_DAYS) {
                priceGrid[month][day] = dayData.c;
            }
        });

        // Fill in missing data using nearby prices
        for (let month = 0; month < GRID_MONTHS; month++) {
            // Forward fill
            let lastValidPrice = priceGrid[month][0];
            for (let day = 0; day < GRID_DAYS; day++) {
                if (priceGrid[month][day] === basePrice) {
                    priceGrid[month][day] = lastValidPrice;
                } else {
                    lastValidPrice = priceGrid[month][day];
                }
            }

            // Backward fill
            lastValidPrice = priceGrid[month][GRID_DAYS - 1];
            for (let day = GRID_DAYS - 1; day >= 0; day--) {
                if (priceGrid[month][day] === basePrice) {
                    priceGrid[month][day] = lastValidPrice;
                } else {
                    lastValidPrice = priceGrid[month][day];
                }
            }
        }

        // Prepare price data for visualization
        const prices = priceGrid.flat();
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        // Create geometry
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const indices = [];
        const colors = []; // For grayscale coloring

        // Create vertex data - month on X axis, day on Z axis
        for (let month = 0; month < GRID_MONTHS; month++) {
            for (let day = 0; day < GRID_DAYS; day++) {
                // Normalize price to height
                const price = priceGrid[month][day];
                const normalizedPrice = (price - minPrice) / (maxPrice - minPrice);
                const height = normalizedPrice * HEIGHT_SCALE;

                // Add vertex position - month is X, day is Z
                positions.push(month, height, day);

                // Add vertex color (grayscale based on normalized price)
                colors.push(normalizedPrice, normalizedPrice, normalizedPrice);
            }
        }

        // Create indices for triangle strip
        for (let month = 0; month < GRID_MONTHS - 1; month++) {
            for (let day = 0; day < GRID_DAYS - 1; day++) {
                const a = month * GRID_DAYS + day;
                const b = month * GRID_DAYS + day + 1;
                const c = (month + 1) * GRID_DAYS + day;
                const d = (month + 1) * GRID_DAYS + day + 1;

                indices.push(a, b, c);
                indices.push(b, d, c);
            }
        }

        // Set buffer attributes
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        // Create material with vertex colors for grayscale effect
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            wireframe: false,
            side: THREE.DoubleSide,
            metalness: 0.2,
            roughness: 0.8
        });

        // Create mesh and scale X to make it more square
        const terrain = new THREE.Mesh(geometry, material);
        terrain.scale.x = X_SCALE_FACTOR; // Scale X (month axis) to make square
        terrainRef.current = terrain;

        // Scene setup
        const width = canvasRef.current.clientWidth;
        const scene = setupScene();
        scene.add(terrain);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // Add axes
        addAxes(scene, minPrice, maxPrice);

        // Camera and renderer
        const camera = setupCamera(width);
        const renderer = setupRenderer(width);
        const { helper } = createHelper(scene);

        // Setup controls
        const controls = setupControls(camera, renderer);

        // Interaction handling
        const onPointerMove = (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        };

        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();

            raycasterRef.current.setFromCamera(pointerRef.current, camera);
            const intersects = raycasterRef.current.intersectObject(terrain);

            if (intersects.length > 0) {
                const point = intersects[0].point;
                helper.visible = true;
                helper.position.copy(point);

                // Calculate month and day - adjust for X scaling
                const monthIndex = Math.floor(point.x / X_SCALE_FACTOR);
                const dayIndex = Math.floor(point.z);

                // Ensure indices are within bounds
                const safeMonthIndex = Math.min(Math.max(0, monthIndex), GRID_MONTHS - 1);
                const safeDayIndex = Math.min(Math.max(0, dayIndex), GRID_DAYS - 1);

                // Get price from the grid
                const price = priceGrid[safeMonthIndex][safeDayIndex];

                const newHoverData = {
                    day: (safeDayIndex + 1).toString(), // +1 for display (1-based days)
                    price: price.toFixed(2),
                    month: (safeMonthIndex + 1).toString(), // +1 for display (1-based months)
                    rawHeight: ((point.y / HEIGHT_SCALE) * 100).toFixed(1)
                };

                lastHitRef.current = newHoverData;
                onHoverData?.(newHoverData);
            } else {
                helper.visible = false;
            }

            renderer.render(scene, camera);
        };

        // Event listeners
        renderer.domElement.addEventListener('pointermove', onPointerMove);

        // Start animation
        animate();

        // Cleanup
        return () => {
            renderer.domElement.removeEventListener('pointermove', onPointerMove);

            // Dispose of Three.js resources
            terrain.geometry.dispose();
            terrain.material.dispose();

            if (controls) {
                controls.dispose();
            }

            renderer.dispose();
        };
    }, [symbol, year, stockData, isLoading, error, onHoverData, basePrice]);

    // Loading and error states
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-[550px]">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-[550px] text-red-500">
                Error: {error}
            </div>
        );
    }

    // Render canvas
    return (
        <div
            ref={canvasRef}
            className="w-full h-[550px] rounded-lg overflow-hidden flex justify-center"
        />
    );
};

export default TerrainShader;