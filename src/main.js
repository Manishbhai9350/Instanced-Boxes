import "./style.css";
import * as THREE from "three";
import fragmentShader from "./shaders/fragment.glsl";
import vertexShader from "./shaders/vertex.glsl";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const { PI } = Math;

const canvas = document.querySelector("canvas");

canvas.width = innerWidth;
canvas.height = innerHeight;

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setClearColor(0x00f0ff);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1);
camera.zoom = 7;
camera.position.set(-80, 40, 80);
camera.lookAt(new THREE.Vector3(0, 0, 0));

const controls = new OrbitControls(camera,canvas)



let Bar = null;

const manager = new THREE.LoadingManager();
const TLoader = new THREE.TextureLoader(manager);
const Draco = new DRACOLoader(manager);
const GLBLoader = new GLTFLoader();

Draco.setDecoderPath("/draco/");
Draco.setDecoderConfig({ type: "wasm" });

const aoMap = TLoader.load("/models/ao-map.png");
aoMap.flipY = false;

// Lights
const amb = new THREE.AmbientLight(0xffffff, 1);
const spotLight = new THREE.SpotLight("red");
spotLight.intensity = 100;
spotLight.angle = Math.PI / 2.5;
spotLight.penumbra = 1;
spotLight.position.set(0.577, 0.477, -0.577);

const spotTarget = new THREE.Object3D();
spotTarget.position.copy(new THREE.Vector3(0, 1000, 1020));

spotLight.target = spotTarget;

scene.add(amb, spotLight);

GLBLoader.setDRACOLoader(Draco);
GLBLoader.load("/models/bar.glb", (model) => {
  Bar = model.scene.children[0];
  InitializeBars(Bar);
});

function InitializeBars(bar) {
  const InstancedCount = 50;
  const Instances = InstancedCount ** 2;

  const BarMat = new THREE.MeshPhysicalMaterial({
    color: "blue",
    metalness: 0.3,
    roughness: 0.5,
    map: aoMap,
    aoMap: aoMap,
    aoMapIntensity: 0.8,
  });

  BarMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
      attribute vec2 puv;
      varying vec2 vPuv;
      #include <common>
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      vPuv = puv;
      #include <begin_vertex>
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `
    varying vec2 vPuv;
    #include <common>
    `
  );

    shader.fragmentShader = shader.fragmentShader.replace(
    '#include <clipping_planes_fragment>',
    `
    vec3 customColor = vec3(1.0, 0.0, 1.0);
    // diffuseColor.rgb = mix(diffuseColor.rgb, customColor, .5);
    diffuseColor.rgb = vec3(vPuv,.1);
    #include <clipping_planes_fragment>
    `
  );


  };

  const InstancedMesh = new THREE.InstancedMesh(
    bar.geometry,
    BarMat,
    Instances
  );
  InstancedMesh.scale.setScalar(0.1);

  const dummy = new THREE.Object3D();

  const PositionUV = new Float32Array(Instances * 2);

  for (let i = 0; i < Instances; i++) {
    for (let j = 0; j < Instances; j++) {
      const currentElement = i * InstancedCount + j;
      dummy.position.set(
        (i - InstancedCount / 2) * 1.5,
        0,
        (j - InstancedCount / 2) * 1.5
      );
      PositionUV[currentElement * 2 + 0] =  (i / InstancedCount);
      PositionUV[currentElement * 2 + 1] = 1 - (j / InstancedCount);
      dummy.updateMatrix();
      InstancedMesh.setMatrixAt(currentElement, dummy.matrix);
    }
  }

  InstancedMesh.geometry.setAttribute(
    "puv",
    new THREE.InstancedBufferAttribute(PositionUV, 2)
  );

  scene.add(InstancedMesh);
}

function Animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(Animate);
}

requestAnimationFrame(Animate);

function resize() {
  const aspect = innerWidth / innerHeight;
  const frustumHeight = 10; // or any world size you want
  const frustumWidth = frustumHeight * aspect;

  camera.left = -frustumWidth / 2;
  camera.right = frustumWidth / 2;
  camera.top = frustumHeight / 2;
  camera.bottom = -frustumHeight / 2;

  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

resize();

window.addEventListener("resize", resize);
