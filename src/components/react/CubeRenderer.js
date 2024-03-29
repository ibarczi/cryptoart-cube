import * as THREE from 'three';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import Effects from './Effects';
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import RoundedBox from 'three-rounded-box';

const RoundedBoxGeometry = RoundedBox(THREE);

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

const cubeFacesOrientation = [
  [0, 0, 1],
  [1, 0, 0],
  [0, 0, -1],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
];

function Boxes(props) {
  const {
    cubeData,
    subSquaresScale = 0.9,
    mainCubeSide = 10,
    thickness = 0.01,
    explosion = 0.1,
    backGroundColor = '#f0f0f0',
    subSquareOpacity = 0.9,
    cylinderOpacity = 0.1,
    cylinderThickness = 0.8,
  } = props;

  const [autoRotate, setAutoRotate] = useState(true);
  let numberPoints = 0;
  const clampedSubSquaresScale = clamp(subSquaresScale, 0, 1);
  const {
    camera,
    scene,
    gl: { domElement },
  } = useThree();

  function toggleAutoRotate() {
    setAutoRotate(!autoRotate);
  }

  useEffect(() => {
    console.log();
    domElement.removeEventListener('auxclick', toggleAutoRotate);
    domElement.addEventListener('auxclick', toggleAutoRotate);
  }, [domElement, autoRotate]);

  const cameraRef = useRef();
  const geometryRef = useRef();

  const facesActive = useMemo(
    () =>
      cubeData.faces.reduce((acc, face) => {
        return [...acc, ...face];
      }, []),
    [cubeData],
  );

  const facesActiveOriginalScale = useMemo(() => [...facesActive]);

  // gets all colors ready to be sent to GPU instances
  const colorArray = useMemo(
    () =>
      Float32Array.from(
        cubeData.faces.reduce((acc, face, index) => {
          const newColor = tempColor.set(cubeData.colors[index]).toArray();
          const _colorArray = new Array(face.length)
            .fill()
            .flatMap((_, i) => tempColor.set(cubeData.colors[index]).toArray());

          const toReturn = [...acc, ..._colorArray];
          return toReturn;
        }, []),
      ),
    [cubeData],
  );

  const meshRef = useRef();
  const cylRef = useRef();
  const prevRef = useRef();

  let cylWidth = 0.05;

  const [cylGeometry, setCylGeometry] = useState(
    new THREE.CylinderGeometry(cylWidth, cylWidth, 1, 32),
  );
  const [hexColorsArray, setHexColorsArray] = useState(cubeData.colors);

  useEffect(() => {
    setHexColorsArray(cubeData.colors);
  }, [cubeData.colors]);

  const [roundedGeometry, setRoundedGeometry] = useState(
    new RoundedBoxGeometry(mainCubeSide, mainCubeSide, mainCubeSide, 0, 5),
  );
  useMemo(() => {
    roundedGeometry.computeVertexNormals();
    roundedGeometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorArray, 3));
  }, [roundedGeometry, colorArray]);
  useEffect(() => {
    scene.background = new THREE.Color(backGroundColor);
  }, [scene, backGroundColor]);

  useEffect(() => {
    if (!meshRef.current || !roundedGeometry || !cylRef.current) {
      return;
    }
    let currentFaceId = 0;

    const halfCubeSide = mainCubeSide / 2;

    const _thickness = thickness || 0.00001; // requested by client.

    const absoluteThickness = halfCubeSide * _thickness;

    // goes through all the cube faces

    for (let cubeFaceIndex = 0; cubeFaceIndex < cubeFacesOrientation.length; cubeFaceIndex++) {
      const coordsToIncreaseVectors = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 1),
      ];

      const faceColor = new THREE.Color(hexColorsArray[cubeFaceIndex]);

      const currentFaceNumberOfSquaresPerLine = Math.sqrt(cubeData.faces[cubeFaceIndex].length);
      const currentFaceOrientationCoords = cubeFacesOrientation[cubeFaceIndex];
      const subFaceRealSideLength = mainCubeSide / currentFaceNumberOfSquaresPerLine;
      const subFaceRelativeSide = 1 / currentFaceNumberOfSquaresPerLine;
      const subFaceRelativeSideScaled = subFaceRelativeSide * clampedSubSquaresScale;

      // get the orientation vectors for moving the  pointer that will draw the subsquares on the correct position
      let nonMovingCoordVector = null;

      let rotationVector;

      let faceDisplacementSignal = 0;

      const mainCubeFaceMovingPointerDirectonVectors = coordsToIncreaseVectors;

      currentFaceOrientationCoords.forEach((coordAxisIsStatic, index) => {
        // if not equal to 0, means this will be the static axis of the pointer.
        // the other 2 remaining axis will be the ones moving
        if (coordAxisIsStatic !== 0) {
          faceDisplacementSignal = coordAxisIsStatic;
          nonMovingCoordVector = mainCubeFaceMovingPointerDirectonVectors.splice(index, 1)[0];
        }
      });

      rotationVector = nonMovingCoordVector.clone();
      rotationVector
        .set(rotationVector.y, rotationVector.x, rotationVector.z)
        .multiplyScalar(faceDisplacementSignal);
      // extracts the face rotation vector - maybe multiply by signal?

      nonMovingCoordVector.multiplyScalar(
        (halfCubeSide + absoluteThickness + explosion) * faceDisplacementSignal,
      ); // gets the displacement for the static coordinate

      const pointerStartPositionVector = mainCubeFaceMovingPointerDirectonVectors[0]
        .clone()
        .add(mainCubeFaceMovingPointerDirectonVectors[1])
        .multiplyScalar(halfCubeSide - subFaceRealSideLength / 2);

      // iterate on face subfaces
      for (let coord1 = 0; coord1 < currentFaceNumberOfSquaresPerLine; coord1++) {
        for (let coord2 = 0; coord2 < currentFaceNumberOfSquaresPerLine; coord2++) {
          tempObject.scale.set(
            facesActiveOriginalScale[currentFaceId]
              ? subFaceRelativeSideScaled * clampedSubSquaresScale
              : 0,
            facesActiveOriginalScale[currentFaceId]
              ? subFaceRelativeSideScaled * clampedSubSquaresScale
              : 0,
            facesActiveOriginalScale[currentFaceId] ? _thickness : 0,
          );

          const coord1PointerVector = mainCubeFaceMovingPointerDirectonVectors[0]
            .clone()
            .multiplyScalar(coord1 * subFaceRealSideLength);

          const coord2PointerVector = mainCubeFaceMovingPointerDirectonVectors[1]
            .clone()
            .multiplyScalar(coord2 * subFaceRealSideLength);

          tempObject.position.copy(
            new THREE.Vector3()
              .add(nonMovingCoordVector)
              .add(pointerStartPositionVector)
              .sub(coord1PointerVector)
              .sub(coord2PointerVector),
          );

          const angle = Math.PI / 2;
          tempObject.rotation.x = 0;
          tempObject.rotation.y = 0;
          tempObject.rotation.z = 0;
          tempObject.rotateOnAxis(rotationVector, angle);

          tempObject.updateMatrix();

          meshRef.current.setMatrixAt(currentFaceId, tempObject.matrix);

          // const cylinderThickness = subSquaresScale * (subFaceRealSideLength / 2);

          tempObject.scale.set(
            cylinderThickness,
            (mainCubeSide + explosion * 2) * faceDisplacementSignal,
            cylinderThickness,
          );

          const cylinderCornerCoordsSignal = [
            [1, 1],
            [1, -1],
            [-1, -1],
            [-1, 1],
          ];

          const cornerDisplacementScalar =
            subFaceRelativeSideScaled * clampedSubSquaresScale * mainCubeSide;

          for (let cornerId = 0; cornerId < 4; cornerId++) {
            const cornerSignals = cylinderCornerCoordsSignal[cornerId];

            const cylinderCoordPointerVector1 = mainCubeFaceMovingPointerDirectonVectors[0]
              .clone()
              .multiplyScalar(
                (cornerSignals[0] * cornerDisplacementScalar) / 2 -
                  cornerSignals[0] * cylinderThickness * cylWidth,
              );

            const cylinderCoordPointerVector2 = mainCubeFaceMovingPointerDirectonVectors[1]
              .clone()
              .multiplyScalar(
                (cornerSignals[1] * cornerDisplacementScalar) / 2 -
                  cornerSignals[1] * cylinderThickness * cylWidth,
              );

            let cylObj = tempObject.clone();

            cylObj.position.sub(nonMovingCoordVector);
            cylObj.position.add(cylinderCoordPointerVector1);
            cylObj.position.add(cylinderCoordPointerVector2);

            cylObj.rotateX(Math.PI / 2);

            if (!facesActiveOriginalScale[currentFaceId]) {
              cylObj.scale.set(0, 0, 0);
            }

            cylObj.updateMatrix();
            const cylinderInstanceIndex = currentFaceId * 4 + cornerId;
            cylRef.current.setMatrixAt(cylinderInstanceIndex, cylObj.matrix);
            cylRef.current.setColorAt(cylinderInstanceIndex, faceColor);
          }
          // }
          currentFaceId++;
        }
      }
    }
    console.log('drawn cube');
    meshRef.current.instanceMatrix.needsUpdate = true;
    cylRef.current.instanceMatrix.needsUpdate = true;
  }, [
    meshRef,
    cylRef,
    thickness,
    subSquaresScale,
    mainCubeSide,
    explosion,
    cubeData,
    hexColorsArray,
    cylinderThickness,
  ]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (!meshRef.current) {
      return;
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[roundedGeometry, null, facesActive.length]}
        // onPointerMove={(e) => set(e.instanceId)}
        // onPointerOut={(e) => set(undefined)}
        renderOrder={1}
      >
        <meshPhysicalMaterial
          vertexColors={THREE.VertexColors}
          // side={THREE.DoubleSide}
          // transmission={0.5}
          roughness={0.1}
          thickness={0.1}
          envMapIntensity={1}
          transparent
          opacity={subSquareOpacity}
          // transmission={0.01}
          // roughness={0.3}
          // thickness={0.5}
          // envMapIntensity={1}
          // clearcoat={0.6}
          // // metalness={0.9}
        />
      </instancedMesh>

      <instancedMesh
        ref={cylRef}
        args={[cylGeometry, null, facesActive.length * 4]}
        renderOrder={0}
        // onPointerMove={(e) => set(e.instanceId)}
        // onPointerOut={(e) => set(undefined)}
      >
        {/*<meshBasicMaterial*/}
        {/*  //vertexColors={THREE.VertexColors}*/}
        {/*  side={THREE.DoubleSide}*/}
        {/*  //transmission={0.8}*/}
        {/*  // roughness={0.3}*/}
        {/*  // thickness={2}*/}
        {/*  // envMapIntensity={4}*/}
        {/*  //transparent*/}
        {/*  // // opacity={0.8}*/}
        {/*  // transmission={1}*/}
        {/*  // roughness={0.3}*/}
        {/*  // thickness={0.5}*/}
        {/*  // envMapIntensity={1}*/}
        {/*  // clearcoat={0.6}*/}
        {/*  // // metalness={0.9}*/}
        {/*/>*/}
        <meshPhysicalMaterial
          //vertexColors={THREE.VertexColors}
          side={THREE.DoubleSide}
          //transmission={0.8}
          roughness={0.1}
          thickness={0.1}
          envMapIntensity={1}
          transparent
          opacity={cylinderOpacity}
          // transmission={1}
          // roughness={0.3}
          // thickness={0.5}
          // envMapIntensity={1}
          // clearcoat={0.6}
          // // metalness={0.9}
        />
      </instancedMesh>

      <PerspectiveCamera position={[0, 0, 25]} makeDefault ref={cameraRef}>
        <pointLight intensity={0.15} />
      </PerspectiveCamera>
      <OrbitControls camera={cameraRef.current} enablePan={false} autoRotate={autoRotate} />
      <React.Suspense fallback={null}>
        <Environment preset="warehouse" />
      </React.Suspense>
    </>
  );
}

export const CubeRenderer = (props) => {
  return (
    <Canvas
      linear
      gl={{ antialias: false, alpha: false }}
      camera={{ position: [0, 0, 15], near: 0.1, far: 200 }}
    >
      <ambientLight intensity={0.15} />
      <Boxes {...props} />
      <Effects />
    </Canvas>
  );
};
