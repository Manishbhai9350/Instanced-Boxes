import "./style.css";
import * as THREE from "three";
import perlin from "./shaders/perlin.glsl";
import simplex from "./shaders/simplex.glsl";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import GUI from "lil-gui";
import gsap from "gsap";

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
renderer.setClearColor(0x06083d);

let frustumSize = innerHeight ;
const aspect = innerWidth / innerHeight;
const camera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  frustumSize / 2,
  frustumSize * 2,
  (frustumSize * aspect) / -2,
  -10000,
  1000
);
let cameraLookAt = new THREE.Vector3(0, 0, 0);
camera.position.set(-1,1,1);
camera.lookAt(cameraLookAt);
camera.zoom = 0.006;

// const controls = new OrbitControls(camera, canvas);

const gui = new GUI();
gui.close();
const amb = new THREE.AmbientLight(0xffe9e9, 0.5);
const spotLight = new THREE.SpotLight("white");
spotLight.intensity = 7000;
spotLight.angle = 0.2;
spotLight.penumbra = 0.4;
spotLight.decay = 1;
spotLight.distance = 3000;
spotLight.position.set(850, 300, -950);

const spotTarget = new THREE.Object3D();
spotLight.target = spotTarget;

spotTarget.position.copy(new THREE.Vector3(-1000, 126, 1000));
spotTarget.updateMatrixWorld();

const Environment = gui.addFolder("Environment");
Environment.close();

Environment.add(spotTarget.position, "x")
  .min(-3000)
  .max(3000)
  .onChange((e) => {
    spotTarget.position.x = e;
    spotLight.target.updateMatrixWorld();
  });
Environment.add(spotTarget.position, "y")
  .min(-3000)
  .max(3000)
  .onChange((e) => {
    spotTarget.position.y = e;
    spotLight.target.updateMatrixWorld();
  });
Environment.add(spotTarget.position, "z")
  .min(-3000)
  .max(3000)
  .onChange((e) => {
    spotTarget.position.z = e;
    spotLight.target.updateMatrixWorld();
  });

Environment.add(spotLight.position, "x")
  .min(-3000)
  .max(3000)
  .onChange((e) => {
    spotLight.position.x = e;
    spotLight.updateMatrixWorld();
  })
  .name("L-x");
Environment.add(spotLight.position, "y")
  .min(-3000)
  .max(3000)
  .onChange((e) => {
    spotLight.position.y = e;
    spotLight.updateMatrixWorld();
  })
  .name("L-y");
Environment.add(spotLight.position, "z")
  .min(-3000)
  .max(3000)
  .onChange((e) => {
    spotLight.position.z = e;
    spotLight.updateMatrixWorld();
  })
  .name("L-z");
Environment.add(spotLight, "penumbra").min(0).max(1).step(0.01);
Environment.add(spotLight, "angle")
  .min(0)
  .max(Math.PI / 2)
  .step(0.01);
Environment.add(spotLight, "decay").min(0).max(10).step(0.01);
Environment.add(spotLight, "intensity").min(0).max(10000).step(0.01);

const manager = new THREE.LoadingManager(InitializeBars);
const TLoader = new THREE.TextureLoader(manager);
const Draco = new DRACOLoader(manager);
const GLBLoader = new GLTFLoader(manager);

Draco.setDecoderPath("/draco/");
Draco.setDecoderConfig({ type: "wasm" });

const aoMap = TLoader.load("/models/ao-map.png");
aoMap.flipY = false;

const maskMap = TLoader.load("/models/mask.png");
const indiaMap = TLoader.load("/models/india.png");

let Bar = null;
let InstancedMesh = null;
let InstancedUniforms = null;

scene.add(amb, spotLight);

GLBLoader.setDRACOLoader(Draco);
GLBLoader.load("/models/bar.glb", (model) => {
  Bar = model.scene.children[0];
});

const uniforms = {
  uStartProg:{value:0},
  uProgress:{value:0},
  uTime: { value: 0 },
  uMask: { value: maskMap }, // Animator Texture
  uIndia:{ value: indiaMap },
  aoMap: { value: null }, // Ambient Occlusion Map Texture
  light_color: { value: new THREE.Color("#ffe9e9") },
  ramp_color_one: { value: new THREE.Color("#06083D") },
  ramp_color_two: { value: new THREE.Color("#020284") },
  ramp_color_three: { value: new THREE.Color("#0000ff") },
  ramp_color_four: { value: new THREE.Color("#71c7f5") },

  // For Simplex Noise 
  // uNoiseMul:{value:20},
  // uPosMul:{value:60},
  // uSpeed:{value:1},

  // For Perlin Noise
  uNoiseMul:{value:25},
  uPosMul:{value:60},
  uSpeed:{value:1.5},
  uOffsetY:{value:0}
};


const Noise = gui.addFolder('Noise')
Noise.close()

function InitializeBars() {
  const InstancedCount = 50;
  const Instances = InstancedCount ** 2;

  const BarMat = new THREE.MeshPhysicalMaterial({
    color: "white",
    metalness: 0.0,
    roughness: 0.3,
    aoMap: aoMap,
    // map: aoMap,
    aoMapIntensity: 0.8,
  });

  gui.close();

  const MatGroup = gui.addFolder("Material");
  MatGroup.close()

  MatGroup.add(BarMat, "roughness").min(0).max(1);
  MatGroup.add(BarMat, "metalness").min(0).max(1);

  // 💉💉 Injecting Custom Shader
  BarMat.onBeforeCompile = (shader) => {
    shader.uniforms = Object.assign(shader.uniforms, uniforms);
    InstancedUniforms = shader.uniforms;

    Noise.add(uniforms.uNoiseMul,'value').min(0).max(100).name('Noise Factor')
    Noise.add(uniforms.uPosMul,'value').min(0).max(100).name('Position Factor')
    Noise.add(uniforms.uSpeed,'value').min(0).max(5).name('Speed')
    Noise.add(uniforms.uOffsetY,'value').min(-30).max(30).name('Offset Y ')

    gui.add(uniforms.uProgress,'value').min(0).max(1)

    
    gsap.to(shader.uniforms.uStartProg,{
      delay:2,
      duration:1.5,
      ease:'power2.in',
      value:1,
      onStart(){
        camera.lookAt(cameraLookAt)
      },
      onUpdate(){
        camera.lookAt(cameraLookAt)
      },
      onComplete(){
        gsap.to(shader.uniforms.uProgress,{
          value:1,
          ease:'power3.inOut',
          duration:2.5
        })
      }
    })
    


    shader.vertexShader = shader.vertexShader.replace(
      "varying vec3 vViewPosition;",
      `
      varying vec3 vViewPosition;
      
      ${perlin}
      `
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `
      uniform float uTime;
      uniform float uProgress;
      uniform sampler2D uMask;
      uniform vec3 ramp_color_one;
      uniform vec3 ramp_color_two;
      uniform vec3 ramp_color_three;
      uniform vec3 ramp_color_four;
      varying vec2 vPuv;
      varying float vY;
      varying float vRing;
      #include <common>
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
          uniform float uStartProg;
          uniform float uProgress;
          uniform float uOffsetY;
          uniform float uNoiseMul;
          uniform float uPosMul;
          uniform float uSpeed;
          uniform float uTime;
          uniform sampler2D uMask;
          uniform sampler2D uIndia;
          attribute vec2 puv;
          varying vec2 vPuv;
          varying float vY;
          varying float vRing;
          #include <common>
          `
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /*glsl*/`
          vPuv = puv;
          #include <begin_vertex>
          vec4 cube = mix(vec4(0.0),texture2D(uMask,puv),uStartProg);
          vec4 india = vec4(1.0) - texture2D(uIndia,puv);

          float len = length(puv - vec2(.5,.5));

          float totalProg = pow(2.0,.5) * len;
          float currentProg = totalProg * uProgress;
          
          float ringThickness = .08 * uStartProg;


          
          float progress = smoothstep(totalProg,totalProg + ringThickness,uProgress + cube.r);
          float ring = smoothstep(totalProg - ringThickness,totalProg,uProgress + cube.r);
          ring = ring - progress; 
          vRing = ring + progress;
          vec4 mask = mix(cube,india,(ring + progress));
          transformed *= ((mask.r));

          float deltaY = 0.0;
          deltaY = uOffsetY + cnoise(vec4(puv.xy * uPosMul,.0,uTime * uSpeed));
          deltaY *= (1.0-ring);

          transformed.y += deltaY * uNoiseMul + ring * 50.0;

          vY = transformed.y;
          `
    );

    

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",

      /*glsl*/`
      vec3 customColor = vec3(1.0, 0.0, 1.0);
      diffuseColor.rgb = ramp_color_three;

      vec3 mixed = mix(
        ramp_color_two,
        ramp_color_three,
        smoothstep(-20.0,-5.0,vY * 0.0) // Multiplied by zero cause i dont want to mix the color two and three when cube goes below
      );
      vec3 final = mix(
        mixed,
        ramp_color_four,
        smoothstep(25.0,35.0,vY)
      );
      diffuseColor.rgb = final;
      vec4 mask = texture2D(uMask,vPuv);
      #include <clipping_planes_fragment>
    `
    );

  };

  Bar.geometry.scale(40, 40, 40);

  InstancedMesh = new THREE.InstancedMesh(Bar.geometry, BarMat, Instances);

  const dummy = new THREE.Object3D();

  const PositionUV = new Float32Array(Instances * 2);

  let w = 60;

  for (let i = 0; i < Instances; i++) {
    for (let j = 0; j < Instances; j++) {
      const currentElement = i * InstancedCount + j;
      dummy.position.set(
        (i - InstancedCount / 2) * w,
        0,
        (j - InstancedCount / 2) * w
      );
      PositionUV[currentElement * 2 + 0] = i / InstancedCount;
      PositionUV[currentElement * 2 + 1] = 1 - j / InstancedCount;
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

const RaycastPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(60 * 49.68,60 * 49.68),
  new THREE.MeshBasicMaterial({color:0xff0000,wireframe:true})
)

RaycastPlane.position.set(-1/2 * 60,0,-1/2 * 60)

const MouseDebugMesh = new THREE.Mesh(
  new THREE.SphereGeometry(100),
  new THREE.MeshBasicMaterial({color:'yellow'})
)
// scene.add(MouseDebugMesh,RaycastPlane)

RaycastPlane.rotation.x = -Math.PI/2

const rMouse = new THREE.Vector2(0,0)

const Raycaster = new THREE.Raycaster()


function onMouse(e){

  return;

  const nx = (e.clientX / innerWidth) * 2 - 1;
  const ny = -(e.clientY / innerHeight) * 2 + 1;

  rMouse.set(nx,ny)

  Raycaster.setFromCamera(rMouse,camera)

  const Intersects = Raycaster.intersectObjects([RaycastPlane],true)

  console.log(Intersects.length)
  if(Intersects.length > 0){
    MouseDebugMesh.position.copy(Intersects[0].point)
  }

}


const clock = new THREE.Clock();
let PrevTime = clock.getElapsedTime();


function Animate() {
  const Time = clock.getElapsedTime();
  const DT = Time - PrevTime;
  if (InstancedMesh && InstancedUniforms) {
    InstancedUniforms.uTime.value = Time;
  }
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
window.addEventListener("mousemove", onMouse);
