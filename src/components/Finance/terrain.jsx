import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';

const TerrainShader = ({ onHoverData, symbol = "AAPL", basePrice = 170 }) => {
    // Constants
    const HEIGHT_SCALE = 15;
    const GRID_SIZE = 128;
    const CANVAS_HEIGHT = 550;
    const MIN_CAMERA_DISTANCE = 30;
    const MAX_CAMERA_DISTANCE = 150;
    const INITIAL_CAMERA_DISTANCE = 50;
    const INITIAL_CAMERA_ELEVATION = 45;

    // Mobile specific constants
    const MOBILE_MAX_CAMERA_DISTANCE = 180;
    const MOBILE_INITIAL_CAMERA_DISTANCE = 100;

    // Refs
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const terrainRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const pointerRef = useRef(new THREE.Vector2());
    const helperRef = useRef(null);
    const minMaxRef = useRef({ min: Infinity, max: -Infinity });
    const controlsRef = useRef(null);
    const interactingWithTerrainRef = useRef(false);

    // Terrain seed state
    const [terrainSeed, setTerrainSeed] = useState(null);

    // Last hover data ref
    const lastHitRef = useRef({
        day: 15,
        price: basePrice.toFixed(2),
        month: 6,
        rawHeight: "50.0"
    });

    // Mobile detection
    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    };

    useEffect(() => {
        // Generate seed only once when symbol first changes
        if (terrainSeed === null) {
            const newSeed = Date.now() % 1000 + symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            setTerrainSeed(newSeed);
        }

        if (!canvasRef.current || terrainSeed === null) return;

        // Initialize with default data
        onHoverData?.(lastHitRef.current);

        // Helper function for creating axis labels (existing implementation)
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

        // Add axes function (existing implementation)
        const addAxes = (scene) => {
            const lowPrice = basePrice;
            const highPrice = basePrice * 1.5;

            // Days axis (X)
            const daysLine = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(-25, 0, 25),
                    new THREE.Vector3(25, 0, 25)
                ]),
                new THREE.LineBasicMaterial({ color: 0xffffff })
            );
            scene.add(daysLine);
            scene.add(createAxisLabel('Days', new THREE.Vector3(0, -3, 25)));

            // Months axis (Z)
            const monthsLine = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(-25, 0, 25),
                    new THREE.Vector3(-25, 0, -25)
                ]),
                new THREE.LineBasicMaterial({ color: 0xffffff })
            );
            scene.add(monthsLine);
            scene.add(createAxisLabel('Months', new THREE.Vector3(-28, -3, 0)));

            // Price axis (Y)
            const priceLine = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(-25, 0, 25),
                    new THREE.Vector3(-25, HEIGHT_SCALE, 25)
                ]),
                new THREE.LineBasicMaterial({ color: 0xffffff })
            );
            scene.add(priceLine);
            scene.add(createAxisLabel('Price', new THREE.Vector3(-30, HEIGHT_SCALE / 2, 25)));

            // Add price labels
            scene.add(createAxisLabel('$' + highPrice.toFixed(0), new THREE.Vector3(-30, HEIGHT_SCALE, 25), 'lightgray'));
            scene.add(createAxisLabel('$' + lowPrice.toFixed(0), new THREE.Vector3(-30, 0, 25), 'lightgray'));

            // Add tick marks and values
            for (let i = 0; i <= 4; i++) {
                const dayPos = -25 + (i * 12.5);
                const dayValue = Math.round(i * 7.75);
                scene.add(createAxisLabel(dayValue.toString(),
                    new THREE.Vector3(dayPos, -2, 25), 'lightgray'));

                const monthPos = 25 - (i * 12.5);
                const monthValue = Math.round(i * 3);
                scene.add(createAxisLabel(monthValue.toString(),
                    new THREE.Vector3(-25, -2, monthPos), 'lightgray'));
            }
        };

        // Scene setup functions (existing implementation)
        const setupScene = () => {
            const scene = new THREE.Scene();
            sceneRef.current = scene;
            return scene;
        };

        const setupCamera = (width) => {
            const camera = new THREE.PerspectiveCamera(45, width / CANVAS_HEIGHT, 0.1, 1000);
            const isMobile = isMobileDevice();
            const initialDistance = isMobile ? MOBILE_INITIAL_CAMERA_DISTANCE : INITIAL_CAMERA_DISTANCE;

            camera.position.set(
                -initialDistance,
                INITIAL_CAMERA_ELEVATION,
                initialDistance
            );
            camera.lookAt(0, -HEIGHT_SCALE / 3, 0);
            cameraRef.current = camera;
            return camera;
        };

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

        const generateTerrain = () => {
            const geometry = new THREE.PlaneGeometry(50, 50, GRID_SIZE, GRID_SIZE);
            geometry.rotateX(-Math.PI / 2);
            const vertices = geometry.attributes.position.array;
            const perlin = new ImprovedNoise();

            const z = terrainSeed % 1000;

            minMaxRef.current = { min: Infinity, max: -Infinity };

            const rawHeights = [];
            for (let i = 0; i < vertices.length; i += 3) {
                const x = (i % ((GRID_SIZE + 1) * 3)) / 3;
                const y = Math.floor(i / ((GRID_SIZE + 1) * 3));

                const nx = (x / GRID_SIZE) * 2;
                const ny = (y / GRID_SIZE) * 2;

                let elevation = 0;
                let amplitude = 1;
                let frequency = 1;

                for (let octave = 0; octave < 4; octave++) {
                    elevation += amplitude * perlin.noise(
                        nx * frequency,
                        ny * frequency,
                        z
                    );
                    amplitude *= 0.5;
                    frequency *= 2;
                }

                rawHeights.push(elevation);
                minMaxRef.current.min = Math.min(minMaxRef.current.min, elevation);
                minMaxRef.current.max = Math.max(minMaxRef.current.max, elevation);
            }

            for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
                const normalizedHeight = (rawHeights[j] - minMaxRef.current.min) /
                    (minMaxRef.current.max - minMaxRef.current.min);
                vertices[i + 1] = normalizedHeight * HEIGHT_SCALE;
            }

            geometry.computeVertexNormals();
            geometry.attributes.position.needsUpdate = true;

            return { geometry, vertices };
        };

        const createShaderMaterial = () => {
            return new THREE.ShaderMaterial({
                uniforms: {
                    minHeight: { value: 0 },
                    maxHeight: { value: HEIGHT_SCALE }
                },
                vertexShader: `
                    uniform float minHeight;
                    uniform float maxHeight;
                    varying float vHeight;
                    void main() {
                        vec4 modelPosition = modelMatrix * vec4(position, 1.0);
                        vHeight = position.y / maxHeight;
                        gl_Position = projectionMatrix * viewMatrix * modelPosition;
                    }
                `,
                fragmentShader: `
                    varying float vHeight;
                    void main() {
                        vec3 color = vec3(vHeight);
                        gl_FragColor = vec4(color, 1.0);
                    }
                `,
                side: THREE.DoubleSide
            });
        };

        const setupControls = (camera, renderer) => {
            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance = MIN_CAMERA_DISTANCE;

            const isMobile = isMobileDevice();
            controls.maxDistance = isMobile ? MOBILE_MAX_CAMERA_DISTANCE : MAX_CAMERA_DISTANCE;

            controls.maxPolarAngle = Math.PI / 2;
            controls.target.set(0, -HEIGHT_SCALE / 3, 0);
            controls.update();
            controlsRef.current = controls;
            return controls;
        };

        // Initial setup
        const width = canvasRef.current.clientWidth;
        const scene = setupScene();
        const camera = setupCamera(width);
        const renderer = setupRenderer(width);
        const { helper, geometryHelper } = createHelper(scene);
        const { geometry, vertices } = generateTerrain();
        const shaderMaterial = createShaderMaterial();

        // Create and add terrain
        const terrain = new THREE.Mesh(geometry, shaderMaterial);
        terrainRef.current = terrain;
        scene.add(terrain);

        // Add axes after terrain generation
        addAxes(scene);

        // Setup controls
        const controls = setupControls(camera, renderer);

        // Interaction handlers (existing implementation)
        const checkTerrainIntersection = () => {
            raycasterRef.current.setFromCamera(pointerRef.current, camera);
            const intersects = raycasterRef.current.intersectObject(terrain);
            return intersects.length > 0;
        };

        const onPointerMove = (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            if (interactingWithTerrainRef.current) {
                return;
            }
        };

        const onPointerDown = (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            const terrainHit = checkTerrainIntersection();

            if (terrainHit && isMobileDevice()) {
                interactingWithTerrainRef.current = true;
                if (controlsRef.current) {
                    controlsRef.current.enableRotate = false;
                }
            }
        };

        const onPointerUp = () => {
            if (interactingWithTerrainRef.current && controlsRef.current) {
                interactingWithTerrainRef.current = false;
                controlsRef.current.enableRotate = true;
            }
        };

        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointercancel', onPointerUp);
        renderer.domElement.addEventListener('pointerleave', onPointerUp);

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();

            raycasterRef.current.setFromCamera(pointerRef.current, camera);
            const intersects = raycasterRef.current.intersectObject(terrain);

            if (intersects.length > 0) {
                const point = intersects[0].point;
                helper.visible = true;
                helper.position.copy(point);

                const normalizedHeight = point.y / HEIGHT_SCALE;
                const priceRange = basePrice * 0.5;
                const price = basePrice + (normalizedHeight * priceRange);

                const normalizedX = (point.x + 25) / 50;
                const day = (normalizedX * 31).toFixed(1);

                const normalizedZ = (-point.z + 25) / 50;
                const month = (normalizedZ * 12).toFixed(1);

                const newHoverData = {
                    day,
                    price: price.toFixed(2),
                    month,
                    rawHeight: (normalizedHeight * 100).toFixed(1)
                };

                lastHitRef.current = newHoverData;
                onHoverData?.(newHoverData);
            } else {
                helper.visible = false;
            }

            renderer.render(scene, camera);
        };

        animate();

        // Handle window resize
        const handleResize = () => {
            const newWidth = canvasRef.current.clientWidth;
            const isMobile = isMobileDevice();
            const renderWidth = isMobile ? newWidth * 0.85 : newWidth;

            camera.aspect = renderWidth / CANVAS_HEIGHT;
            camera.updateProjectionMatrix();
            renderer.setSize(renderWidth, CANVAS_HEIGHT);

            if (isMobile) {
                renderer.domElement.style.margin = '0 auto';
            }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            renderer.domElement.removeEventListener('pointermove', onPointerMove);
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            renderer.domElement.removeEventListener('pointerup', onPointerUp);
            renderer.domElement.removeEventListener('pointercancel', onPointerUp);
            renderer.domElement.removeEventListener('pointerleave', onPointerUp);

            if (controlsRef.current) {
                controlsRef.current.dispose();
            }

            if (sceneRef.current) {
                while (sceneRef.current.children.length > 0) {
                    const object = sceneRef.current.children[0];
                    sceneRef.current.remove(object);

                    if (object.geometry) {
                        object.geometry.dispose();
                    }

                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }

                        if (object.material.map) {
                            object.material.map.dispose();
                        }
                    }
                }
            }

            if (rendererRef.current) {
                rendererRef.current.dispose();

                try {
                    const gl = rendererRef.current.getContext();
                    const loseContextExt = gl.getExtension('WEBGL_lose_context');
                    if (loseContextExt) {
                        loseContextExt.loseContext();
                    }
                } catch (error) {
                    console.warn('Could not lose WebGL context:', error);
                }
            }
        };
    }, [onHoverData, symbol, basePrice, terrainSeed]);

    return (
        <div
            ref={canvasRef}
            className="w-full h-[550px] rounded-lg overflow-hidden flex justify-center"
        />
    );
};

export default TerrainShader;