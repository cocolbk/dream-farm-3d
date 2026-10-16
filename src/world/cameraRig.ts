import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Clamped orbit rig: rotate + zoom, no going under terrain. Touch = 1-finger orbit, pinch zoom.
export function createCameraRig(canvas: HTMLCanvasElement): { controls: OrbitControls; camera: THREE.PerspectiveCamera } {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(14, 16, 18);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(-4, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI / 2.4;
  controls.update();
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
  return { controls, camera };
}
