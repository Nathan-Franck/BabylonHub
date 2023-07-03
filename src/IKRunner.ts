import { Vector3, Quaternion, TransformNode } from "babylonjs";

function AngleBetween3Lengths(a: number, b: number, c: number): number {
  return Math.acos((a * a + b * b - c * c) / (2 * a * b));
}
function ikRunner(
  state: {
    position: Vector3;
    rotation: Quaternion;
  },
  settings: {
    BlendElbowToWristYaw: number;
    ForearmBlend: number;
    ForarmLength: number;
    UpperArmLength: number;
  },
  nodes: {
    Shoulder: TransformNode;
    Elbow: TransformNode;
    Forearm: TransformNode;
    ForearmMid: TransformNode;
    Wrist: TransformNode;
  }
) {
  // Elbow should try to get to orientation target
  const {
    BlendElbowToWristYaw, ForarmLength, UpperArmLength, ForearmBlend
  } = settings;

  // Orient shoulder to have down facing the elbow target, and forward facing the wrist target
  const shoulderToWrist: Vector3 = state.position.subtract(nodes.Shoulder.position);
  const startingShoulderRotation: Quaternion = Quaternion.FromLookDirectionLH // LH or RH?
    (shoulderToWrist, Vector3.Lerp(Vector3.Up(), Vector3.Up().applyRotationQuaternion(state.rotation), BlendElbowToWristYaw));

  // Calculate elbow angle required to get wrist to target position
  const shoulderToWristDistance: number = shoulderToWrist.length();
  const elbowAngle: number = AngleBetween3Lengths(ForarmLength, UpperArmLength, shoulderToWristDistance);
  const shoulderAngle: number = AngleBetween3Lengths(shoulderToWristDistance, UpperArmLength, ForarmLength);

  const halfPi = Math.PI * 0.5;

  nodes.Shoulder.rotationQuaternion = startingShoulderRotation.multiply(Quaternion.RotationAxis(Vector3.Right(), halfPi + shoulderAngle)).multiply(Quaternion.RotationAxis(Vector3.Up(), -90));
  nodes.Elbow.rotationQuaternion = Quaternion.RotationAxis(Vector3.Forward(), Math.PI - elbowAngle);

  // Orient forearm to view wrist target within reasonable limits
  nodes.Forearm.rotationQuaternion = Quaternion.FromLookDirectionLH(Vector3.Up(), Vector3.Forward().applyRotationQuaternion(Quaternion.Inverse(nodes.Elbow.absoluteRotationQuaternion).multiply(state.rotation))).multiply(Quaternion.RotationAxis(Vector3.Right(), halfPi));
  // Rotate mid region half of what forearm got rotated
  nodes.ForearmMid.rotationQuaternion = Quaternion.Slerp(Quaternion.Identity(), nodes.Forearm.rotationQuaternion, ForearmBlend);
  // Rotate wrist to view wrist target - only allow a very small amount of Yaw
  nodes.Wrist.rotationQuaternion = Quaternion.FromLookDirectionLH(Vector3.Right(), Vector3.Up().applyRotationQuaternion(Quaternion.Inverse(nodes.Forearm.absoluteRotationQuaternion).multiply(state.rotation))).multiply(Quaternion.RotationAxis(Vector3.Up(), -90));
}

// ikRunner(
//   {
//     rotation: camera.rotationQuaternion,
//     position: camera.position,
//   },
//   {
//     BlendElbowToWristYaw: 0.5,
//     ForearmBlend: 0.5,
//     ForarmLength: 0.5,
//     UpperArmLength: 0.5,
//   },
//   FPSRig.transformNodes,
// );