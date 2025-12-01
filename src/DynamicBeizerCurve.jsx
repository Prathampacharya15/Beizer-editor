import { useRef, useEffect } from "react";
import * as THREE from "three";

const DynamicBezierScene = () => {
  const mountRef = useRef(null);

  const points = useRef([]); // user points
  const controlPoints = useRef([]); // one control point per segment
  const curveLine = useRef(null);
  const isDragging = useRef(false);
  const draggedControl = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const controlMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const curveMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    const createSphere = (pos, mat, radius = 0.15) => {
      const geom = new THREE.SphereGeometry(radius, 16, 16);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos);
      scene.add(mesh);
      return mesh;
    };

    // Compute control points to make smooth curvy quadratic Bézier
    const computeControlPoints = (updateExisting = false) => {
      const n = points.current.length;
      if (n < 2) return;

      for (let i = 0; i < n - 1; i++) {
        const p0 = points.current[i];
        const p1 = points.current[i + 1];

        // midpoint of the segment
        const midpoint = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);

        // direction vector from start to end
        const dir = new THREE.Vector3().subVectors(p1, p0);

        // perpendicular offset in XY plane for natural curve
        const offset = new THREE.Vector3(-dir.y, dir.x, 0).normalize().multiplyScalar(1.5);

        const c = new THREE.Vector3().addVectors(midpoint, offset);

        if (updateExisting && controlPoints.current[i]) {
          // only update if no manual adjustment
          if (!controlPoints.current[i].manual) controlPoints.current[i].c.copy(c);
        } else {
          controlPoints.current[i] = { c, sphere: null, manual: false };
        }
      }
    };

    // Draw curve
    const drawCurve = () => {
      if (curveLine.current) scene.remove(curveLine.current);
      if (points.current.length < 2) return;

      const curvePoints = [];
      for (let i = 0; i < points.current.length - 1; i++) {
        const { c } = controlPoints.current[i];
        const curve = new THREE.QuadraticBezierCurve3(points.current[i], c, points.current[i + 1]);
        curvePoints.push(...curve.getPoints(50));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
      curveLine.current = new THREE.Line(geometry, curveMaterial);
      scene.add(curveLine.current);

      // Update or create control point spheres
      controlPoints.current.forEach((seg, idx) => {
        if (!seg.sphere) {
          seg.sphere = createSphere(seg.c, controlMaterial, 0.12);
          seg.sphere.userData = { segment: idx };
        } else {
          seg.sphere.position.copy(seg.c);
        }
      });
    };

    // Add new point
    const addPoint = (position) => {
      createSphere(position, pointMaterial);
      points.current.push(position.clone());

      computeControlPoints(true); // update only unmodified control points
      drawCurve();
    };

    // Check if a control point is clicked for dragging
    const checkDrag = (intersection) => {
      for (let i = 0; i < controlPoints.current.length; i++) {
        const seg = controlPoints.current[i];
        if (intersection.distanceTo(seg.c) < 0.3) {
          isDragging.current = true;
          draggedControl.current = i;
          seg.manual = true; // mark manual adjustment
          return true;
        }
      }
      return false;
    };

    const onMouseDown = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersection);

      if (!checkDrag(intersection)) addPoint(intersection);
    };

    const onMouseMove = (event) => {
      if (!isDragging.current) return;
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersection);

      if (draggedControl.current !== null) {
        const seg = controlPoints.current[draggedControl.current];
        seg.c.copy(intersection);
        drawCurve();
      }
    };

    const onMouseUp = () => {
      isDragging.current = false;
      draggedControl.current = null;
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseup", onMouseUp);

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mouseup", onMouseUp);
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef}></div>;
};

export default DynamicBezierScene;
