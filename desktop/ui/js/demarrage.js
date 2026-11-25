setupDecisionInterface();
configureDates();
mapCanvases.forEach(bindMap);
const resizing = new ResizeObserver(scheduleDraw);
[...mapCanvases, element("trend")].forEach((canvas) => resizing.observe(canvas));
aerial.addEventListener("load", () => {
  updateFieldList();
  scheduleDraw();
});
aerial.src = AERIAL_IMAGE;
recenter();
update();
