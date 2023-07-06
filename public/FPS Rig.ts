export const FpsRigSpec = <const>
{
  "meshes": {
    "Arm": "Armature",
    "Banana": "Armature"
  },
  "transformNodes": {
    "Armature": null,
    "Reference": null,
    "Reference.001": null,
    "Reference.002": null,
    "Shoulder": null,
    "Elbow": "Shoulder",
    "Forearm": "Elbow",
    "Hand": "Forearm",
    "Finger.Pinky.A": "Hand",
    "Finger.Pinky.B": "Finger.Pinky.A",
    "Finger.Pinky.C": "Finger.Pinky.B",
    "Finger.Ring.A": "Hand",
    "Finger.Ring.B": "Finger.Ring.A",
    "Finger.Ring.C": "Finger.Ring.B",
    "Finger.Middle.A": "Hand",
    "Finger.Middle.B": "Finger.Middle.A",
    "Finger.Middle.C": "Finger.Middle.B",
    "Finger.Pointer.A": "Hand",
    "Finger.Pointer.B": "Finger.Pointer.A",
    "Finger.Pointer.C": "Finger.Pointer.B",
    "Thumb.A": "Hand",
    "Thumb.B": "Thumb.A",
    "Thumb.C": "Thumb.B",
    "Palm.Fold.B": "Hand",
    "Palm.Fold.A": "Hand",
    "ForearmMid": "Elbow"
  },
  "skeletons": {
    "Armature": true
  },
  "lights": {},
  "animationGroups": {
    "Grip": true,
    "Slip": true,
    "WristCurl": true
  }
}
