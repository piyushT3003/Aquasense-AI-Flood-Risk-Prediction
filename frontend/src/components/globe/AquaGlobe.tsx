import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { Zone } from "../../services/api";

interface AquaGlobeProps {
  zones: Zone[];
  selectedZone: Zone | null;
  onSelectZone: (zone: Zone) => void;
  isStormActive: boolean;
}

export const AquaGlobe: React.FC<AquaGlobeProps> = ({
  zones,
  selectedZone,
  onSelectZone,
  isStormActive
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const stormRef = useRef(isStormActive);
  stormRef.current = isStormActive;
  const hasZones = zones.length > 0;
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    globeGroup: THREE.Group;
    rainParticles: THREE.Points;
    radarRing: THREE.Mesh;
    orbitRings: THREE.Group;
    bengaluruMarker: THREE.Group;
    zoneMarkers: THREE.Group;
  } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 8, 26);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // 2. Earth Sphere Base
    const radius = 9.0;
    const globeGeo = new THREE.SphereGeometry(radius, 64, 64);
    const globeMat = new THREE.MeshPhongMaterial({
      color: 0x050c18,
      emissive: 0x04101c,
      specular: 0x123047,
      shininess: 25,
      transparent: true,
      opacity: 0.94
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    globeGroup.add(globeMesh);

    // 3. Dot Grid / Lat-Long Grid (Nexora aesthetic)
    const gridHelper = new THREE.WireframeGeometry(new THREE.SphereGeometry(radius + 0.05, 36, 18));
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.12
    });
    const gridLines = new THREE.LineSegments(gridHelper, gridMat);
    globeGroup.add(gridLines);

    // 4. Dot matrix particles for landmass simulation
    const particleCount = 2800;
    const dotPositions = new Float32Array(particleCount * 3);
    const dotColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / particleCount);
      const theta = Math.sqrt(particleCount * Math.PI) * phi;
      const r = radius + 0.08;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      dotPositions[i * 3] = x;
      dotPositions[i * 3 + 1] = y;
      dotPositions[i * 3 + 2] = z;

      // Subtle crimson/amber color variation
      const isRed = Math.random() > 0.65;
      dotColors[i * 3] = isRed ? 0.13 : 0.35;
      dotColors[i * 3 + 1] = isRed ? 0.83 : 0.45;
      dotColors[i * 3 + 2] = isRed ? 0.93 : 0.6;
    }

    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPositions, 3));
    dotGeo.setAttribute("color", new THREE.BufferAttribute(dotColors, 3));
    const dotMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.75
    });
    const dotsMesh = new THREE.Points(dotGeo, dotMat);
    globeGroup.add(dotsMesh);

    // 5. Orbiting Elliptical Rings (As in Nexora screenshot)
    const orbitRings = new THREE.Group();
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35
    });

    const createRing = (rX: number, rY: number, rotX: number, rotY: number) => {
      const curve = new THREE.EllipseCurve(0, 0, rX, rY, 0, 2 * Math.PI, false, 0);
      const points = curve.getPoints(120);
      const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(ringGeo, ringMat);
      line.rotation.x = rotX;
      line.rotation.y = rotY;
      return line;
    };

    orbitRings.add(createRing(12.5, 12.5, Math.PI / 3.5, 0.4));
    orbitRings.add(createRing(13.8, 11.2, -Math.PI / 4, -0.6));
    orbitRings.add(createRing(11.8, 13.0, Math.PI / 2.2, 0.8));
    scene.add(orbitRings);

    // 6. Coordinates Helper: Convert Lat/Lng to Vector3 on Globe
    const latLngToVector3 = (lat: number, lng: number, alt: number = radius + 0.12) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      const x = -(alt * Math.sin(phi) * Math.cos(theta));
      const z = alt * Math.sin(phi) * Math.sin(theta);
      const y = alt * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    };

    // 7. Bengaluru Pinpoint Focus Marker (12.9716 N, 77.5946 E)
    const blrPos = latLngToVector3(12.9716, 77.5946, radius + 0.15);
    const bengaluruMarker = new THREE.Group();
    bengaluruMarker.position.copy(blrPos);

    // Core pulsing red sphere
    const blrCoreGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const blrCoreMat = new THREE.MeshBasicMaterial({ color: 0xff2a4b });
    const blrCore = new THREE.Mesh(blrCoreGeo, blrCoreMat);
    bengaluruMarker.add(blrCore);

    // Radial warning wave rings
    const blrRingGeo = new THREE.RingGeometry(0.35, 0.48, 32);
    const blrRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const blrRing = new THREE.Mesh(blrRingGeo, blrRingMat);
    blrRing.lookAt(blrPos.clone().multiplyScalar(2));
    bengaluruMarker.add(blrRing);

    globeGroup.add(bengaluruMarker);

    // 8. 18 Pilot Flood Zone Markers
    const zoneMarkers = new THREE.Group();
    const getZoneColor = (score: number) => {
      if (score >= 0.85) return 0xf43f5e; // SEVERE
      if (score >= 0.65) return 0xfb923c; // HIGH
      if (score >= 0.35) return 0xfbbf24; // MEDIUM
      return 0x34d399; // LOW
    };

    zones.forEach((z) => {
      // Offset slightly around Bengaluru center for visual clarity on globe
      const zPos = latLngToVector3(
        z.center.lat + (Math.random() - 0.5) * 0.15,
        z.center.lng + (Math.random() - 0.5) * 0.15,
        radius + 0.18
      );
      const prob = z.current_prediction?.risk_score ?? 0;
      const markerGeo = new THREE.CylinderGeometry(0.06, 0.02, 0.45, 8);
      const markerMat = new THREE.MeshBasicMaterial({ color: getZoneColor(prob) });
      const pin = new THREE.Mesh(markerGeo, markerMat);
      pin.position.copy(zPos);
      pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), zPos.clone().normalize());
      pin.userData = { zoneId: z.id };
      zoneMarkers.add(pin);
    });
    globeGroup.add(zoneMarkers);

    // 9. Animated 3D Rainfall Particle System
    const rainCount = 450;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);
    const rainVelocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
      // Rain clustered around Bengaluru coordinate vector
      const spread = 2.2;
      rainPositions[i * 3] = blrPos.x + (Math.random() - 0.5) * spread;
      rainPositions[i * 3 + 1] = blrPos.y + (Math.random() - 0.5) * spread + 0.8;
      rainPositions[i * 3 + 2] = blrPos.z + (Math.random() - 0.5) * spread;
      rainVelocities[i] = 0.03 + Math.random() * 0.05;
    }

    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x60a5fa,
      size: 0.12,
      transparent: true,
      opacity: 0.85
    });
    const rainParticles = new THREE.Points(rainGeo, rainMat);
    globeGroup.add(rainParticles);

    // 10. Radar Scan Sweep Ring
    const radarGeo = new THREE.RingGeometry(0.6, 2.8, 48);
    const radarMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    const radarRing = new THREE.Mesh(radarGeo, radarMat);
    radarRing.position.copy(blrPos);
    radarRing.lookAt(blrPos.clone().multiplyScalar(2));
    globeGroup.add(radarRing);

    // 11. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const redLight = new THREE.PointLight(0x22d3ee, 2.6, 50);
    redLight.position.set(12, 14, 20);
    scene.add(redLight);

    const blueLight = new THREE.PointLight(0x3b82f6, 1.2, 40);
    blueLight.position.set(-15, -10, 15);
    scene.add(blueLight);

    // Focus camera directly on Bengaluru location initially
    globeGroup.rotation.y = -1.45;
    globeGroup.rotation.x = 0.22;

    sceneRef.current = {
      scene,
      camera,
      renderer,
      globeGroup,
      rainParticles,
      radarRing,
      orbitRings,
      bengaluruMarker,
      zoneMarkers
    };

    // 12. Mouse Drag Orbit Controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !sceneRef.current) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      sceneRef.current.globeGroup.rotation.y += deltaX * 0.005;
      sceneRef.current.globeGroup.rotation.x += deltaY * 0.005;
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!sceneRef.current) return;
      camera.position.z = Math.max(16, Math.min(38, camera.position.z + e.deltaY * 0.02));
    };

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("wheel", handleWheel, { passive: false });

    // 13. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Subtle slow globe rotation
      if (!isDragging) {
        globeGroup.rotation.y += 0.0012;
      }

      // Rotate orbital rings
      orbitRings.rotation.z = elapsed * 0.06;
      orbitRings.rotation.y = elapsed * 0.04;

      // Pulse Bengaluru marker ring
      const scale = 1.0 + Math.sin(elapsed * 4.0) * 0.35;
      blrRing.scale.set(scale, scale, 1);
      (blrRingMat as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.8 - Math.sin(elapsed * 4.0) * 0.4);

      // Radar sweep rotation
      radarRing.rotation.z = elapsed * (stormRef.current ? 4.0 : 1.8);

      // Live marker colours from the latest polled predictions (no scene rebuild)
      zoneMarkers.children.forEach((pin: any) => {
        const z = zonesRef.current.find((q) => q.id === pin.userData.zoneId);
        if (z) (pin.material as THREE.MeshBasicMaterial).color.setHex(getZoneColor(z.current_prediction?.risk_score ?? 0));
      });

      // Rain particles falling down
      const positions = rainGeo.attributes.position.array as Float32Array;
      const rainSpeedMultiplier = stormRef.current ? 2.5 : 1.0;

      for (let i = 0; i < rainCount; i++) {
        positions[i * 3 + 1] -= rainVelocities[i] * rainSpeedMultiplier;
        // reset if below globe surface
        const currY = positions[i * 3 + 1];
        if (currY < blrPos.y - 1.2) {
          positions[i * 3 + 1] = blrPos.y + 1.2 + Math.random() * 0.5;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !sceneRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, [hasZones]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-[540px] flex items-center justify-center overflow-hidden">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Radar & Bengaluru Overlay HUD */}
      <div className="absolute bottom-4 left-6 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md text-xs">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span className="text-zinc-300 font-mono">BENGALURU GIS: 12.9716° N, 77.5946° E</span>
        </div>
      </div>

      <div className="absolute bottom-4 right-6 pointer-events-none text-right">
        <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md text-[11px] text-zinc-400 space-y-0.5">
          <div className="text-white font-semibold">WebGL 3D Earth Telemetry</div>
          <div>Drag to rotate • Scroll to zoom</div>
          <div className="text-cyan-300 font-mono">18 Flood Zones Monitored</div>
        </div>
      </div>
    </div>
  );
};
