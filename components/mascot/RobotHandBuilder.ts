import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type HandPoseName =
  | "open"
  | "relaxed"
  | "grip"
  | "typing"
  | "pointing"
  | "wave";

export type FingerRig = {
  proximal: THREE.Group;
  distal: THREE.Group;
  baseSpreadZ: number;
};

export type ArticulatedHandRig = {
  handGroup: THREE.Group;
  fingersGroup: THREE.Group;
  gripAnchor: THREE.Group;
  thumbRoot: THREE.Group;
  thumbDistal: THREE.Group;
  indexFinger: FingerRig;
  otherFingers: FingerRig[]; // [middle, ring, pinky]
  allFingers: FingerRig[]; // [index, middle, ring, pinky]
};

export type CreateArticulatedHandParams = {
  side: -1 | 1;
  scale?: number;
  whiteShellMat: THREE.Material;
  jointDarkMat: THREE.Material;
  palmMat?: THREE.Material;
  fingerMat?: THREE.Material;
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T;
};

export function createArticulatedHand({
  side,
  scale = 1,
  whiteShellMat,
  jointDarkMat,
  palmMat,
  fingerMat,
  trackGeo,
}: CreateArticulatedHandParams): ArticulatedHandRig {
  const shellMat = palmMat ?? whiteShellMat;
  const fMat = fingerMat ?? whiteShellMat;

  const handGroup = new THREE.Group();
  handGroup.scale.setScalar(scale);

  // Dark mechanical wrist ball blending cleanly into forearm cuff
  const wristJoint = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.042, 14, 14)),
    jointDarkMat
  );
  wristJoint.position.set(0, 0.016, 0);
  handGroup.add(wristJoint);

  // Sculpted palm shell
  const palm = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.104, 0.094, 0.056, 4, 0.024)),
    shellMat
  );
  palm.position.set(0, -0.042, 0);
  palm.castShadow = true;
  palm.receiveShadow = true;
  handGroup.add(palm);

  // Inner dark mechanical palm pad (visible on open welcoming hand)
  const palmPad = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.072, 0.062, 0.014, 2, 0.006)),
    jointDarkMat
  );
  palmPad.position.set(0, -0.043, 0.024);
  handGroup.add(palmPad);

  // Grip anchor centered cleanly inside curled fingers & opposing thumb
  const gripAnchor = new THREE.Group();
  gripAnchor.position.set(0, -0.062, 0.056);
  handGroup.add(gripAnchor);

  // Opposable articulated thumb (located on outer side = side * X)
  const thumbRoot = new THREE.Group();
  thumbRoot.position.set(side * 0.052, -0.024, 0.012);
  handGroup.add(thumbRoot);

  const thumbKnuckle = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.015, 10, 10)),
    jointDarkMat
  );
  thumbRoot.add(thumbKnuckle);

  const thumbProx = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.017, 0.028, 6, 10)),
    fMat
  );
  thumbProx.position.set(0, -0.02, 0);
  thumbProx.castShadow = true;
  thumbRoot.add(thumbProx);

  const thumbDistal = new THREE.Group();
  thumbDistal.position.set(0, -0.039, 0);
  thumbRoot.add(thumbDistal);

  const thumbMidJoint = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.0135, 10, 10)),
    jointDarkMat
  );
  thumbDistal.add(thumbMidJoint);

  const thumbTip = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.015, 0.024, 6, 10)),
    fMat
  );
  thumbTip.position.set(0, -0.017, 0);
  thumbTip.castShadow = true;
  thumbDistal.add(thumbTip);

  // 4 Articulated Fingers (Index -> Pinky across palm edge)
  const fingersGroup = new THREE.Group();
  fingersGroup.position.set(0, -0.086, 0.004);
  handGroup.add(fingersGroup);

  const fingerSpecs = [
    { x: side * 0.037, len: 0.96, spreadZ: side * 0.08 }, // Index
    { x: side * 0.0125, len: 1.06, spreadZ: side * 0.02 }, // Middle
    { x: -side * 0.0125, len: 0.98, spreadZ: -side * 0.04 }, // Ring
    { x: -side * 0.036, len: 0.82, spreadZ: -side * 0.11 }, // Pinky
  ];

  const allFingers: FingerRig[] = fingerSpecs.map((spec) => {
    const proximal = new THREE.Group();
    proximal.position.set(spec.x, 0, 0);
    proximal.rotation.z = spec.spreadZ;
    fingersGroup.add(proximal);

    const knuckle = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.0145, 10, 10)),
      jointDarkMat
    );
    proximal.add(knuckle);

    const proxLen = 0.036 * spec.len;
    const proxMesh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.0155, proxLen, 6, 10)),
      fMat
    );
    proxMesh.position.set(0, -(proxLen * 0.5 + 0.009), 0);
    proxMesh.castShadow = true;
    proximal.add(proxMesh);

    const distal = new THREE.Group();
    distal.position.set(0, -(proxLen + 0.018), 0);
    proximal.add(distal);

    const midJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.0125, 10, 10)),
      jointDarkMat
    );
    distal.add(midJoint);

    const distLen = 0.026 * spec.len;
    const distMesh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.0138, distLen, 6, 10)),
      fMat
    );
    distMesh.position.set(0, -(distLen * 0.5 + 0.008), 0);
    distMesh.castShadow = true;
    distal.add(distMesh);

    return { proximal, distal, baseSpreadZ: spec.spreadZ };
  });

  const rig: ArticulatedHandRig = {
    handGroup,
    fingersGroup,
    gripAnchor,
    thumbRoot,
    thumbDistal,
    indexFinger: allFingers[0],
    otherFingers: allFingers.slice(1),
    allFingers,
  };

  applyHandPose(rig, side, "relaxed");
  return rig;
}

export function applyHandPose(
  rig: ArticulatedHandRig,
  side: -1 | 1,
  pose: HandPoseName
) {
  switch (pose) {
    case "open": {
      // Friendly open gesture: splayed thumb, gently curved welcoming fingers
      rig.thumbRoot.rotation.set(-0.24, -side * 0.35, side * 0.85);
      rig.thumbDistal.rotation.set(-0.25, 0, -side * 0.15);
      rig.allFingers.forEach((f, idx) => {
        f.proximal.rotation.x = -(0.22 + idx * 0.06);
        f.proximal.rotation.z = f.baseSpreadZ * 1.45;
        f.distal.rotation.x = -(0.24 + idx * 0.06);
      });
      break;
    }

    case "grip": {
      // Firm ergonomic cylindrical grip (e.g., studio microphone or map edge)
      rig.thumbRoot.rotation.set(-0.55, -side * 0.82, side * 0.32);
      rig.thumbDistal.rotation.set(-0.65, 0, -side * 0.25);
      rig.allFingers.forEach((f) => {
        f.proximal.rotation.x = -0.92;
        f.proximal.rotation.z = f.baseSpreadZ * 0.28;
        f.distal.rotation.x = -1.12;
      });
      break;
    }

    case "typing": {
      // Natural arched keyboard hover pose
      rig.thumbRoot.rotation.set(-0.42, -side * 0.45, side * 0.58);
      rig.thumbDistal.rotation.set(-0.28, 0, -side * 0.15);
      rig.allFingers.forEach((f, idx) => {
        f.proximal.rotation.x = -(0.38 + (idx % 2) * 0.12);
        f.proximal.rotation.z = f.baseSpreadZ * 0.8;
        f.distal.rotation.x = -(0.52 + idx * 0.06);
      });
      break;
    }

    case "pointing": {
      // Index extended straight, remaining fingers curled cleanly into palm
      rig.thumbRoot.rotation.set(-0.38, -side * 0.72, side * 0.48);
      rig.thumbDistal.rotation.set(-0.42, 0, 0);
      rig.indexFinger.proximal.rotation.set(-0.08, 0, 0);
      rig.indexFinger.distal.rotation.set(-0.06, 0, 0);
      rig.otherFingers.forEach((f) => {
        f.proximal.rotation.x = -1.15;
        f.proximal.rotation.z = f.baseSpreadZ * 0.3;
        f.distal.rotation.x = -1.1;
      });
      break;
    }

    case "wave": {
      // Cheerful open palm wave
      rig.thumbRoot.rotation.set(-0.18, -side * 0.25, side * 0.78);
      rig.thumbDistal.rotation.set(-0.18, 0, 0);
      rig.allFingers.forEach((f, idx) => {
        f.proximal.rotation.x = -(0.12 + idx * 0.04);
        f.proximal.rotation.z = f.baseSpreadZ * 1.5;
        f.distal.rotation.x = -(0.15 + idx * 0.04);
      });
      break;
    }

    case "relaxed":
    default: {
      rig.thumbRoot.rotation.set(-0.25, -side * 0.4, side * 0.58);
      rig.thumbDistal.rotation.set(-0.25, 0, 0);
      rig.allFingers.forEach((f, idx) => {
        f.proximal.rotation.x = -(0.32 + idx * 0.07);
        f.proximal.rotation.z = f.baseSpreadZ;
        f.distal.rotation.x = -(0.35 + idx * 0.07);
      });
      break;
    }
  }
}
