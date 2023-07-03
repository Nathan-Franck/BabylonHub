export function CreateStandardCanvas() {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.id = "gameCanvas";
  document.body.style.margin = "0px";
  document.body.style.width = "100%";
  document.body.style.height = "100%";
  document.body.style.overflow = "hidden";
  const app = document.getElementById("app")!;
  app.style.width = "100%";
  app.style.height = "100%";
  app.style.position = "absolute";
  app.style.top = "0px";
  app.style.left = "0px";
  app.appendChild(canvas);
  return canvas;
}
