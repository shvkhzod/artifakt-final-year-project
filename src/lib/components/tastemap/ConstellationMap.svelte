<script lang="ts">
	import * as THREE from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
	import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
	import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
	import type { Item, Cluster } from '$lib/utils/types';
	import { CLUSTER_COLORS } from '$lib/utils/colors';

	/* ── Types ────────────────────────────────────── */

	interface MapNode {
		id: string;
		item: Item;
		cluster: Cluster | null;
	}

	interface Props {
		nodes: MapNode[];
		onSelectNode?: (item: Item, cluster: Cluster | null) => void;
	}

	let { nodes, onSelectNode }: Props = $props();

	/* ── Refs and state ──────────────────────────── */

	let containerEl: HTMLDivElement | undefined = $state();
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let hoveredNode: MapNode | null = $state(null);
	let tooltipPos = $state({ x: 0, y: 0 });
	let clusterNames: string[] = $state([]);

	/* ── Reduced motion ──────────────────────────── */

	let prefersReducedMotion = $state(false);

	$effect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = mq.matches;
		function onChange(e: MediaQueryListEvent) {
			prefersReducedMotion = e.matches;
		}
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	/* ── Cluster color map ───────────────────────── */

	/** Convert a CSS hex string like '#E69F00' to a Three.js numeric hex */
	function hexToNum(hex: string): number {
		return parseInt(hex.replace('#', ''), 16);
	}

	const DEFAULT_COLOR_HEX = hexToNum(CLUSTER_COLORS.amber);

	function getClusterHex(cluster: Cluster | null): number {
		if (!cluster) return DEFAULT_COLOR_HEX;
		return hexToNum(cluster.color);
	}

	/* ── Node sizing by item type ────────────────── */

	function nodeRadius(item: Item): number {
		switch (item.type) {
			case 'image': return 4;
			case 'screenshot': return 3.5;
			case 'quote': return 3;
			case 'article': return 2.5;
			default: return 2.5;
		}
	}

	/* ── Organic glow textures ───────────────────── */

	// Simple 2D noise for organic variation
	function noise2D(x: number, y: number): number {
		const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
		return n - Math.floor(n);
	}

	function fbmNoise(x: number, y: number, octaves: number = 4): number {
		let value = 0;
		let amplitude = 0.5;
		let frequency = 1;
		for (let i = 0; i < octaves; i++) {
			value += amplitude * noise2D(x * frequency, y * frequency);
			amplitude *= 0.5;
			frequency *= 2.1;
		}
		return value;
	}

	// Inner core texture — bright center with slight organic wobble
	function createCoreTexture(): THREE.Texture {
		const size = 128;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d')!;
		const imageData = ctx.createImageData(size, size);
		const cx = size / 2, cy = size / 2;

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const dx = (x - cx) / cx;
				const dy = (y - cy) / cy;
				let dist = Math.sqrt(dx * dx + dy * dy);

				// Add organic wobble to the distance
				const noiseVal = fbmNoise(dx * 3, dy * 3, 3) * 0.15;
				dist = Math.max(0, dist + noiseVal - 0.07);

				// Sharp bright core fading to soft edge
				let alpha = 0;
				if (dist < 0.3) {
					alpha = 1.0;
				} else if (dist < 1.0) {
					alpha = Math.pow(1.0 - (dist - 0.3) / 0.7, 2.0);
				}

				const idx = (y * size + x) * 4;
				imageData.data[idx] = 255;
				imageData.data[idx + 1] = 255;
				imageData.data[idx + 2] = 255;
				imageData.data[idx + 3] = Math.floor(alpha * 255);
			}
		}

		ctx.putImageData(imageData, 0, 0);
		const tex = new THREE.CanvasTexture(canvas);
		tex.needsUpdate = true;
		return tex;
	}

	// Mid glow — organic, blobby aura with noise distortion
	function createMidGlowTexture(): THREE.Texture {
		const size = 256;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d')!;
		const imageData = ctx.createImageData(size, size);
		const cx = size / 2, cy = size / 2;

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const dx = (x - cx) / cx;
				const dy = (y - cy) / cy;
				let dist = Math.sqrt(dx * dx + dy * dy);

				// Strong organic noise distortion
				const angle = Math.atan2(dy, dx);
				const noiseVal = fbmNoise(dx * 2.5 + 10, dy * 2.5 + 10, 5) * 0.35;
				const angularNoise = fbmNoise(angle * 2, dist * 4, 3) * 0.2;
				dist = Math.max(0, dist + noiseVal + angularNoise - 0.15);

				let alpha = 0;
				if (dist < 1.0) {
					// Soft exponential falloff
					alpha = Math.exp(-dist * dist * 3.5) * 0.8;
				}

				const idx = (y * size + x) * 4;
				imageData.data[idx] = 255;
				imageData.data[idx + 1] = 255;
				imageData.data[idx + 2] = 255;
				imageData.data[idx + 3] = Math.floor(alpha * 255);
			}
		}

		ctx.putImageData(imageData, 0, 0);
		const tex = new THREE.CanvasTexture(canvas);
		tex.needsUpdate = true;
		return tex;
	}

	// Outer haze — very soft, large, wispy
	function createOuterHazeTexture(): THREE.Texture {
		const size = 256;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d')!;
		const imageData = ctx.createImageData(size, size);
		const cx = size / 2, cy = size / 2;

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const dx = (x - cx) / cx;
				const dy = (y - cy) / cy;
				let dist = Math.sqrt(dx * dx + dy * dy);

				// Wispy tendrils via angular noise
				const angle = Math.atan2(dy, dx);
				const tendril = fbmNoise(angle * 3 + 5, dist * 2 + 5, 4) * 0.4;
				const warp = fbmNoise(dx * 1.5 + 20, dy * 1.5 + 20, 3) * 0.25;
				dist = Math.max(0, dist + warp - tendril * 0.5);

				let alpha = 0;
				if (dist < 1.0) {
					alpha = Math.exp(-dist * dist * 2.0) * 0.35;
				}

				const idx = (y * size + x) * 4;
				imageData.data[idx] = 255;
				imageData.data[idx + 1] = 255;
				imageData.data[idx + 2] = 255;
				imageData.data[idx + 3] = Math.floor(alpha * 255);
			}
		}

		ctx.putImageData(imageData, 0, 0);
		const tex = new THREE.CanvasTexture(canvas);
		tex.needsUpdate = true;
		return tex;
	}

	/* ── Cluster label sprite ────────────────────── */

	function createLabelSprite(text: string): THREE.Sprite {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d')!;
		const fontSize = 36;
		const padding = 16;

		ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`;
		const metrics = ctx.measureText(text.toUpperCase());
		const textWidth = metrics.width;

		canvas.width = textWidth + padding * 2;
		canvas.height = fontSize + padding * 2;

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`;
		ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);

		const texture = new THREE.CanvasTexture(canvas);
		texture.needsUpdate = true;

		const mat = new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
			opacity: 0.6,
			depthTest: false,
			sizeAttenuation: true,
		});

		const sprite = new THREE.Sprite(mat);
		const aspect = canvas.width / canvas.height;
		sprite.scale.set(aspect * 30, 30, 1);
		return sprite;
	}

	/* ── 3D Layout ───────────────────────────────── */

	function distributeClusterCentroids(clusterIds: string[], radius: number): Map<string, THREE.Vector3> {
		const map = new Map<string, THREE.Vector3>();
		const n = clusterIds.length;
		const goldenAngle = Math.PI * (3 - Math.sqrt(5));

		for (let i = 0; i < n; i++) {
			const y = 1 - (i / (n - 1 || 1)) * 2;
			const radiusAtY = Math.sqrt(1 - y * y);
			const theta = goldenAngle * i;
			map.set(clusterIds[i], new THREE.Vector3(
				Math.cos(theta) * radiusAtY * radius,
				y * radius,
				Math.sin(theta) * radiusAtY * radius
			));
		}
		return map;
	}

	function gaussianRandom(): number {
		let u = 0, v = 0;
		while (u === 0) u = Math.random();
		while (v === 0) v = Math.random();
		return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
	}

	/* ── Three.js scene ──────────────────────────── */

	$effect(() => {
		if (!canvasEl || !containerEl || nodes.length === 0) return;

		const scene = new THREE.Scene();

		const rect = containerEl.getBoundingClientRect();
		let w = rect.width || window.innerWidth;
		let h = rect.height || window.innerHeight;

		const camera = new THREE.PerspectiveCamera(60, w / h, 1, 5000);
		camera.position.set(0, 60, 500);
		camera.lookAt(0, 0, 0);

		const renderer = new THREE.WebGLRenderer({
			canvas: canvasEl,
			antialias: true,
			alpha: true,
		});
		renderer.setClearColor(0x000000, 1);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(w, h);
		renderer.toneMapping = THREE.NoToneMapping;

		// ── Post-processing bloom ──
		const composer = new EffectComposer(renderer);
		const renderPass = new RenderPass(scene, camera);
		composer.addPass(renderPass);

		const bloomPass = new UnrealBloomPass(
			new THREE.Vector2(w, h),
			0.8,   // strength — visible glow around cores
			0.5,   // radius — moderate spread
			0.35   // threshold — cores bloom, haze doesn't
		);
		composer.addPass(bloomPass);

		// ── Lighting (minimal — glow comes from emissive + sprites) ──
		scene.add(new THREE.AmbientLight(0x111122, 0.15));

		// ── Controls ──
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.04;
		controls.minDistance = 100;
		controls.maxDistance = 1500;
		controls.enablePan = true;
		controls.rotateSpeed = 0.4;

		// ── Groups ──
		const nodeGroup = new THREE.Group();
		scene.add(nodeGroup);

		// ── Create organic textures ──
		const coreTexture = createCoreTexture();
		const midGlowTexture = createMidGlowTexture();
		const outerHazeTexture = createOuterHazeTexture();

		// ── Compute cluster centroids ──
		const clusterIdSet = new Set<string>();
		const uniqueClusterNames: string[] = [];
		for (const n of nodes) {
			const cid = n.cluster?.id ?? '__none__';
			if (!clusterIdSet.has(cid)) {
				clusterIdSet.add(cid);
				if (n.cluster) uniqueClusterNames.push(n.cluster.name);
			}
		}
		clusterNames = uniqueClusterNames;

		const clusterIds = [...clusterIdSet];
		const centroids = distributeClusterCentroids(clusterIds, 200);

		// ── Build nodes ──
		interface NodeData {
			mapNode: MapNode;
			mesh: THREE.Mesh;
			coreSprite: THREE.Sprite;
			midGlow: THREE.Sprite;
			outerHaze: THREE.Sprite;
			baseRadius: number;
			breathPhase: number;    // unique offset so they don't pulse in sync
			breathSpeed: number;    // unique speed
			breathAmplitude: number; // unique intensity
		}

		const nodeDatas: NodeData[] = [];
		const meshToNodeData = new Map<THREE.Object3D, NodeData>();

		for (const n of nodes) {
			const cid = n.cluster?.id ?? '__none__';
			const centroid = centroids.get(cid) ?? new THREE.Vector3();
			const radius = nodeRadius(n.item);
			const colorHex = getClusterHex(n.cluster);
			const color = new THREE.Color(colorHex);

			// Emissive color for bloom to pick up
			const emissiveColor = color.clone().multiplyScalar(1.5);

			const stddev = 60;
			const pos = new THREE.Vector3(
				centroid.x + gaussianRandom() * stddev,
				centroid.y + gaussianRandom() * stddev,
				centroid.z + gaussianRandom() * stddev
			);

			// ── Sphere (emissive so bloom catches it) ──
			const geo = new THREE.SphereGeometry(radius, 32, 20);
			const mat = new THREE.MeshStandardMaterial({
				color,
				emissive: emissiveColor,
				emissiveIntensity: 0.7,
				roughness: 0.3,
				metalness: 0.1,
			});
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.copy(pos);
			nodeGroup.add(mesh);

			// ── Layer 1: Core glow (tight, bright, organic edges) ──
			const coreMat = new THREE.SpriteMaterial({
				map: coreTexture,
				color: emissiveColor,
				transparent: true,
				opacity: 0.85,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			});
			const coreSprite = new THREE.Sprite(coreMat);
			const coreScale = radius * 3.5;
			coreSprite.scale.set(coreScale, coreScale, 1);
			coreSprite.position.copy(pos);
			nodeGroup.add(coreSprite);

			// ── Layer 2: Mid glow (blobby aura, noise-distorted) ──
			const midMat = new THREE.SpriteMaterial({
				map: midGlowTexture,
				color,
				transparent: true,
				opacity: 0.25,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			});
			const midGlow = new THREE.Sprite(midMat);
			const midScale = radius * 7;
			midGlow.scale.set(midScale, midScale, 1);
			midGlow.position.copy(pos);
			nodeGroup.add(midGlow);

			// ── Layer 3: Outer haze (wispy tendrils, very large) ──
			const hazeMat = new THREE.SpriteMaterial({
				map: outerHazeTexture,
				color,
				transparent: true,
				opacity: 0.08,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			});
			const outerHaze = new THREE.Sprite(hazeMat);
			const hazeScale = radius * 14;
			outerHaze.scale.set(hazeScale, hazeScale, 1);
			outerHaze.position.copy(pos);
			nodeGroup.add(outerHaze);

			// Unique breathing parameters per node
			const data: NodeData = {
				mapNode: n,
				mesh,
				coreSprite,
				midGlow,
				outerHaze,
				baseRadius: radius,
				breathPhase: Math.random() * Math.PI * 2,
				breathSpeed: 0.3 + Math.random() * 0.5,
				breathAmplitude: 0.08 + Math.random() * 0.12,
			};
			nodeDatas.push(data);
			meshToNodeData.set(mesh, data);
		}

		// ── Connection lines ──
		const byCluster = new Map<string, NodeData[]>();
		for (const nd of nodeDatas) {
			const cid = nd.mapNode.cluster?.id ?? '__none__';
			if (!byCluster.has(cid)) byCluster.set(cid, []);
			byCluster.get(cid)!.push(nd);
		}

		for (const [, group] of byCluster) {
			const colorHex = group[0] ? getClusterHex(group[0].mapNode.cluster) : 0xe69f00;
			const lineMat = new THREE.LineBasicMaterial({
				color: colorHex,
				transparent: true,
				opacity: 0.1,
			});
			for (let i = 0; i < group.length; i++) {
				for (let j = i + 1; j < Math.min(i + 3, group.length); j++) {
					const geo = new THREE.BufferGeometry().setFromPoints([
						group[i].mesh.position,
						group[j].mesh.position,
					]);
					nodeGroup.add(new THREE.Line(geo, lineMat));
				}
			}
		}

		// Cross-cluster lines
		if (nodeDatas.length > 5) {
			const crossMat = new THREE.LineBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.03,
			});
			for (let i = 0; i < Math.min(4, nodeDatas.length); i++) {
				const a = nodeDatas[i];
				const b = nodeDatas[(i + 5) % nodeDatas.length];
				if (a.mapNode.cluster?.id !== b.mapNode.cluster?.id) {
					const geo = new THREE.BufferGeometry().setFromPoints([
						a.mesh.position, b.mesh.position,
					]);
					nodeGroup.add(new THREE.Line(geo, crossMat));
				}
			}
		}

		// ── Cluster labels ──
		for (const [cid, centroid] of centroids) {
			const nd = nodeDatas.find(d => (d.mapNode.cluster?.id ?? '__none__') === cid);
			if (!nd?.mapNode.cluster) continue;
			const label = createLabelSprite(nd.mapNode.cluster.name);
			label.position.copy(centroid);
			label.position.y += 80;
			nodeGroup.add(label);
		}

		// ── Starfield ──
		const starCount = 600;
		const starPositions = new Float32Array(starCount * 3);
		for (let i = 0; i < starCount; i++) {
			let x, y, z;
			do {
				x = (Math.random() - 0.5) * 2;
				y = (Math.random() - 0.5) * 2;
				z = (Math.random() - 0.5) * 2;
			} while (x * x + y * y + z * z > 1);
			const r = 800 + Math.random() * 700;
			const len = Math.sqrt(x * x + y * y + z * z) || 1;
			starPositions[i * 3] = (x / len) * r;
			starPositions[i * 3 + 1] = (y / len) * r;
			starPositions[i * 3 + 2] = (z / len) * r;
		}
		const starGeo = new THREE.BufferGeometry();
		starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
		scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
			color: 0xffffff,
			size: 1.0,
			transparent: true,
			opacity: 0.25,
			sizeAttenuation: true,
			depthWrite: false,
		})));

		// ── Raycasting ──
		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		let currentHovered: NodeData | null = null;

		function setHoverState(nd: NodeData | null) {
			// Reset previous
			if (currentHovered) {
				const prev = currentHovered;
				prev.mesh.scale.setScalar(1);
				(prev.coreSprite.material as THREE.SpriteMaterial).opacity = 0.85;
				(prev.midGlow.material as THREE.SpriteMaterial).opacity = 0.25;
				(prev.outerHaze.material as THREE.SpriteMaterial).opacity = 0.08;
			}
			// Set new
			if (nd) {
				nd.mesh.scale.setScalar(1.4);
				(nd.coreSprite.material as THREE.SpriteMaterial).opacity = 1.0;
				(nd.midGlow.material as THREE.SpriteMaterial).opacity = 0.5;
				(nd.outerHaze.material as THREE.SpriteMaterial).opacity = 0.2;
			}
			currentHovered = nd;
			hoveredNode = nd?.mapNode ?? null;
		}

		function onPointerMove(event: PointerEvent) {
			const r = renderer.domElement.getBoundingClientRect();
			pointer.x = ((event.clientX - r.left) / r.width) * 2 - 1;
			pointer.y = -((event.clientY - r.top) / r.height) * 2 + 1;

			raycaster.setFromCamera(pointer, camera);
			const meshes = nodeDatas.map(nd => nd.mesh);
			const intersects = raycaster.intersectObjects(meshes, false);

			if (intersects.length > 0) {
				const nd = meshToNodeData.get(intersects[0].object) ?? null;
				if (nd !== currentHovered) setHoverState(nd);
				tooltipPos = { x: event.clientX, y: event.clientY };
				renderer.domElement.style.cursor = 'pointer';
			} else {
				if (currentHovered) setHoverState(null);
				renderer.domElement.style.cursor = 'grab';
			}
		}

		function onClick() {
			if (currentHovered) {
				onSelectNode?.(currentHovered.mapNode.item, currentHovered.mapNode.cluster);
			}
		}

		renderer.domElement.addEventListener('pointermove', onPointerMove);
		renderer.domElement.addEventListener('click', onClick);

		// ── Auto-rotation ──
		let autoRotate = !prefersReducedMotion;
		let interactionTimeout: ReturnType<typeof setTimeout> | null = null;

		controls.addEventListener('start', () => {
			autoRotate = false;
			if (interactionTimeout) clearTimeout(interactionTimeout);
		});
		controls.addEventListener('end', () => {
			if (prefersReducedMotion) return;
			interactionTimeout = setTimeout(() => { autoRotate = true; }, 3000);
		});

		// ── Resize ──
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const cr = entry.contentRect;
				w = cr.width;
				h = cr.height;
				camera.aspect = w / h;
				camera.updateProjectionMatrix();
				renderer.setSize(w, h);
				composer.setSize(w, h);
				bloomPass.resolution.set(w, h);
			}
		});
		resizeObserver.observe(containerEl);

		// ── Animation loop ──
		let frameId: number;
		const clock = new THREE.Clock();

		function animate() {
			frameId = requestAnimationFrame(animate);
			const elapsed = clock.getElapsedTime();

			// Auto-rotate
			if (autoRotate && !prefersReducedMotion) {
				nodeGroup.rotation.y += 0.0008;
			}

			// ── Organic breathing animation ──
			if (!prefersReducedMotion) {
				for (const nd of nodeDatas) {
					const breath = Math.sin(elapsed * nd.breathSpeed + nd.breathPhase);
					const pulse = 1 + breath * nd.breathAmplitude;

					// Scale the glow layers organically
					const coreS = nd.baseRadius * 3.5 * pulse;
					nd.coreSprite.scale.set(coreS, coreS, 1);

					const midS = nd.baseRadius * 7 * (1 + breath * nd.breathAmplitude * 1.3);
					nd.midGlow.scale.set(midS, midS, 1);

					// Outer haze breathes slower, inverse phase for organic feel
					const hazeBreath = Math.sin(elapsed * nd.breathSpeed * 0.6 + nd.breathPhase + 1.0);
					const hazeS = nd.baseRadius * 14 * (1 + hazeBreath * nd.breathAmplitude * 0.8);
					nd.outerHaze.scale.set(hazeS, hazeS, 1);

					// Subtle opacity modulation on mid glow
					const baseMidOpacity = nd === currentHovered ? 0.5 : 0.25;
					(nd.midGlow.material as THREE.SpriteMaterial).opacity =
						baseMidOpacity + breath * 0.04;

					// Subtle emissive intensity modulation
					const mat = nd.mesh.material as THREE.MeshStandardMaterial;
					mat.emissiveIntensity = 0.7 + breath * 0.15;
				}
			}

			controls.update();
			composer.render();
		}

		animate();

		// ── Cleanup ──
		return () => {
			cancelAnimationFrame(frameId);
			resizeObserver.disconnect();
			renderer.domElement.removeEventListener('pointermove', onPointerMove);
			renderer.domElement.removeEventListener('click', onClick);
			controls.dispose();
			if (interactionTimeout) clearTimeout(interactionTimeout);

			scene.traverse((obj) => {
				if (obj instanceof THREE.Mesh) {
					obj.geometry.dispose();
					if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
					else obj.material.dispose();
				}
				if (obj instanceof THREE.Line) {
					obj.geometry.dispose();
					if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
					else obj.material.dispose();
				}
				if (obj instanceof THREE.Sprite) {
					(obj.material as THREE.SpriteMaterial).map?.dispose();
					obj.material.dispose();
				}
				if (obj instanceof THREE.Points) {
					obj.geometry.dispose();
					if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
					else obj.material.dispose();
				}
			});

			coreTexture.dispose();
			midGlowTexture.dispose();
			outerHazeTexture.dispose();
			composer.dispose();
			renderer.dispose();
		};
	});
</script>

<div class="constellation-container" bind:this={containerEl}>
	<canvas bind:this={canvasEl} class="constellation-canvas"></canvas>
</div>

<!-- Screen reader summary -->
<div class="sr-only" aria-live="polite">
	Taste Map showing {nodes.length} items across {clusterNames.length} clusters.
	{#each clusterNames as name}
		{name}.
	{/each}
</div>

<!-- Tooltip -->
{#if hoveredNode}
	<div
		class="tooltip"
		style="left: {tooltipPos.x + 16}px; top: {tooltipPos.y - 12}px"
	>
		<span class="tooltip-type">{hoveredNode.item.type}</span>
		{#if hoveredNode.item.title}
			<span class="tooltip-title">{hoveredNode.item.title}</span>
		{/if}
		{#if hoveredNode.cluster}
			<span class="tooltip-cluster" style="color: {hoveredNode.cluster.color}">
				{hoveredNode.cluster.name}
			</span>
		{/if}
	</div>
{/if}

<style>
	.constellation-container {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.constellation-canvas {
		display: block;
		width: 100%;
		height: 100%;
		outline: none;
	}

	.tooltip {
		position: fixed;
		z-index: var(--z-navbar);
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-xs) var(--space-sm);
		background: rgba(15, 15, 16, 0.92);
		backdrop-filter: blur(12px);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		animation: fadeIn var(--duration-fast) var(--ease-out);
		max-width: 220px;
	}

	.tooltip-type {
		font-size: var(--text-2xs);
		font-weight: 500;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.tooltip-title {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-primary);
		line-height: var(--leading-snug);
	}

	.tooltip-cluster {
		font-size: var(--text-xs);
		font-weight: 500;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
