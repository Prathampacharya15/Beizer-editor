import * as THREE from "three";

export function createHandleLine(start, end, color = 0x888888) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    start.clone(),
    end.clone(),
  ]);

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.6,
  });

  return new THREE.Line(geometry, material);
}

export function updateHandleLine(line, start, end) {
  const pos = line.geometry.attributes.position.array;

  pos[0] = start.x;
  pos[1] = start.y;
  pos[2] = start.z;

  pos[3] = end.x;
  pos[4] = end.y;
  pos[5] = end.z;

  line.geometry.attributes.position.needsUpdate = true;
}
