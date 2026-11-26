setupDecisionInterface();
configureDates();
mapCanvases.forEach(bindMap);
const resizing = new ResizeObserver(scheduleDraw);
[...mapCanvases, element("trend")].forEach((canvas) => resizing.observe(canvas));
recenter();
update();
void refreshWorkerFields();
