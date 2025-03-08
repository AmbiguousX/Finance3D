import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';


const TerrainShader = ({ onHoverData }) => {
    // Constants
    const HEIGHT_SCALE = 15;
    const GRID_SIZE = 128;
    const CANVAS_HEIGHT = 550;
    const MIN_CAMERA_DISTANCE = 30;
    const MAX_CAMERA_DISTANCE = 100;
    const INITIAL_CAMERA_DISTANCE = 50;
    const INITIAL_CAMERA_ELEVATION = 45;

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
    const lastHitRef = useRef({
        day: 15,
        price: "175.00",
        month: 6,
        rawHeight: "50.0"
    });
    const controlsRef = useRef(null); // Add ref for controls
    const interactingWithTerrainRef = useRef(false); // Track if user is interacting with terrain

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize with default data
        onHoverData?.(lastHitRef.current);

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

        const addAxes = (scene) => {
            // Calculate the actual price values
            const lowPrice = 100; // Since we calculate price as: 100 + (normalizedHeight * 150)
            const highPrice = 250; // When height is 1, price is 100 + (1 * 150)

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

            // Add price labels at top and bottom
            scene.add(createAxisLabel('$' + highPrice, new THREE.Vector3(-30, HEIGHT_SCALE, 25), 'lightgray'));
            scene.add(createAxisLabel('$' + lowPrice, new THREE.Vector3(-30, 0, 25), 'lightgray'));

            // Add tick marks and values
            for (let i = 0; i <= 4; i++) {
                // Days ticks
                const dayPos = -25 + (i * 12.5);
                const dayValue = Math.round(i * 7.75);
                scene.add(createAxisLabel(dayValue.toString(),
                    new THREE.Vector3(dayPos, -2, 25), 'lightgray'));

                // Months ticks
                const monthPos = 25 - (i * 12.5);
                const monthValue = Math.round(i * 3);
                scene.add(createAxisLabel(monthValue.toString(),
                    new THREE.Vector3(-25, -2, monthPos), 'lightgray'));
            }
        };

        const setupScene = () => {
            const scene = new THREE.Scene();
            sceneRef.current = scene;
            return scene;
        };

        const setupCamera = (width) => {
            const camera = new THREE.PerspectiveCamera(45, width / CANVAS_HEIGHT, 0.1, 1000);
            camera.position.set(
                -INITIAL_CAMERA_DISTANCE,
                INITIAL_CAMERA_ELEVATION,
                INITIAL_CAMERA_DISTANCE
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
            renderer.setSize(width, CANVAS_HEIGHT);
            canvasRef.current.innerHTML = '';
            canvasRef.current.appendChild(renderer.domElement);
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
            const z = Math.random() * 100;

            // First pass: generate raw heights and find min/max
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

            // Second pass: normalize heights
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
            controls.maxDistance = MAX_CAMERA_DISTANCE;
            controls.maxPolarAngle = Math.PI / 2;
            controls.target.set(0, -HEIGHT_SCALE / 3, 0);
            controls.update();
            controlsRef.current = controls; // Store controls in ref
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

        // Function to check if terrain was hit
        const checkTerrainIntersection = () => {
            raycasterRef.current.setFromCamera(pointerRef.current, camera);
            const intersects = raycasterRef.current.intersectObject(terrain);
            return intersects.length > 0;
        };

        // Mouse/touch movement handler
        const onPointerMove = (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // On pointer move, if already interacting with terrain, keep rotation disabled
            if (interactingWithTerrainRef.current) {
                // We don't need to check again - keep rotation disabled
                return;
            }
        };

        // Add touch/pointer down event
        const onPointerDown = (event) => {
            // Update pointer position
            const rect = renderer.domElement.getBoundingClientRect();
            pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // Check if the ray hits the terrain
            const terrainHit = checkTerrainIntersection();

            // If ray hits terrain, disable rotation on mobile
            if (terrainHit && isMobileDevice()) {
                interactingWithTerrainRef.current = true;
                if (controlsRef.current) {
                    controlsRef.current.enableRotate = false;
                }
            }
        };

        // Add touch/pointer up event
        const onPointerUp = () => {
            // Re-enable rotation when pointer is released
            if (interactingWithTerrainRef.current && controlsRef.current) {
                interactingWithTerrainRef.current = false;
                controlsRef.current.enableRotate = true;
            }
        };

        // Helper function to detect mobile devices
        const isMobileDevice = () => {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
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
                const price = 100 + (normalizedHeight * 150);

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
            camera.aspect = newWidth / CANVAS_HEIGHT;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, CANVAS_HEIGHT);
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
            controls.dispose();
            renderer.dispose();
            geometry.dispose();
            shaderMaterial.dispose();
            geometryHelper.dispose();
            scene.children.forEach(child => {
                if (child.material) {
                    if (child.material.map) {
                        child.material.map.dispose();
                    }
                    child.material.dispose();
                }
                if (child.geometry) {
                    child.geometry.dispose();
                }
            });
        };
    }, [onHoverData]);

    return (
        <div
            ref={canvasRef}
            className="w-full h-[550px] rounded-lg overflow-hidden"
        />
    );
};

export default TerrainShader;