import bpy
import os
import sys

bl_info = {
    "name": "Static GLTF Exporter",
    "blender": (2, 80, 0),
    "category": "Import-Export",
}


def register():
    # print("Hello World")
    bpy.utils.register_class(ExportStaticGLTF)
    bpy.types.TOPBAR_MT_file_export.append(menu_func_export)


def unregister():
    # print("Goodbye World")
    bpy.utils.unregister_class(ExportStaticGLTF)
    bpy.types.TOPBAR_MT_file_export.remove(menu_func_export)


def menu_func_export(self, context):
    self.layout.operator(ExportStaticGLTF.bl_idname, text="Static GLTF (.gltf + .ts)")


class ExportStaticGLTF(bpy.types.Operator):
    """Export to Static GLTF"""

    bl_idname = "export_scene.static_gltf"
    bl_label = "Export Static GLTF"
    bl_options = {"REGISTER"}

    @classmethod
    def poll(cls, context):
        return True

    def execute(self, context):
        # Get the path to the file
        dir = os.path.dirname(bpy.data.filepath)
        filenameWithExt = os.path.basename(bpy.data.filepath)
        filename = os.path.splitext(filenameWithExt)[0]
        gltfPath = os.path.join(dir, filename + ".gltf")

        # Export the gltf file
        bpy.ops.export_scene.gltf(
            export_format="GLTF_SEPARATE",
            filepath=gltfPath,
            export_apply=True,
        )

        # Create the path to the d.ts file
        dtsPath = os.path.join(dir, filename + ".ts")

        # Create a variable name (no spaces and camel case)
        variableName = "".join([word.capitalize() for word in filename.split(" ")])

        # Write the d.ts file
        with open(dtsPath, "w") as dtsFile:
            dtsFile.write(f"export const {variableName}Spec = " + "<const>{\n")
            dtsFile.write("  meshes: {\n")
            for object in bpy.data.objects:
                if object.type == "MESH":
                    dtsFile.write(f'    "{object.name}": true,\n')
            dtsFile.write("  },\n")
            dtsFile.write("  transformNodes: {\n")
            for objects in bpy.data.objects:
                if objects.type == "EMPTY":
                    dtsFile.write(f'    "{objects.name}": true,\n')
            for armature in bpy.data.armatures:
                for bone in armature.bones:
                    dtsFile.write(f'    "{bone.name}": true,\n')
            dtsFile.write("  },\n")
            dtsFile.write("  skeletons: {\n")
            for skeleton in bpy.data.armatures:
                dtsFile.write(f'    "{skeleton.name}": true,\n')
            dtsFile.write("  },\n")
            dtsFile.write("  lights: {\n")
            for light in bpy.data.lights:
                dtsFile.write(f'    "{light.name}": true,\n')
            dtsFile.write("  },\n")
            dtsFile.write("  animationGroups: {\n")
            for action in bpy.data.actions:
                dtsFile.write(f'    "{action.name}": true,\n')
            dtsFile.write("  },\n")
            dtsFile.write("}\n")
        return {"FINISHED"}
