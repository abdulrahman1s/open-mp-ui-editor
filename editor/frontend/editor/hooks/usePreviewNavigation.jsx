import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useEditor } from "../EditorProvider";
import { clampZoom, zoomToBounds } from "../viewport.mjs";

export function usePreviewNavigation(space, viewport) {
  const {
    view,
    setView,
    previewView: frame,
    previewControls,
    plan,
    editing,
    canvas,
  } = useEditor();
  const anchor = useRef(null),
    pan = useRef(null),
    held = useRef(false);
  const [grabbing, setGrabbing] = useState(false),
    [hand, setHand] = useState(false);
  function setZoom(value, event) {
    canvas.current?.focus({ preventScroll: true });
    if (value === "fit") {
      anchor.current = { fit: true };
      setView({ zoom: "fit" });
      return;
    }
    const box = viewport.current.getBoundingClientRect(),
      area = space.current.getBoundingClientRect();
    const x = event?.clientX ?? area.left + area.width / 2,
      y = event?.clientY ?? area.top + area.height / 2;
    anchor.current = {
      u: (x - box.left) / box.width,
      v: (y - box.top) / box.height,
      x: x - area.left,
      y: y - area.top,
    };
    setView({
      zoom: String(Math.round(clampZoom(Number(value)) * 1000) / 1000),
    });
  }
  function fitUI() {
    if (!plan) return;
    canvas.current?.focus({ preventScroll: true });
    anchor.current = {
      u: (plan.x + plan.width / 2) / 640,
      v: (plan.y + plan.height / 2) / Number(view.projection),
      x: space.current.clientWidth / 2,
      y: space.current.clientHeight / 2,
    };
    setView({
      zoom: String(
        zoomToBounds(
          { w: plan.width, h: plan.height },
          view.resolution,
          {
            width: space.current.clientWidth,
            height: space.current.clientHeight,
          },
          Number(view.projection),
          frame.density,
        ),
      ),
    });
  }
  useLayoutEffect(() => {
    previewControls.current = {
      setZoom,
      zoomBy: (factor) => setZoom(frame.factor * factor),
      fitUI,
    };
    return () => {
      previewControls.current = null;
    };
  });
  useLayoutEffect(() => {
    const target = anchor.current;
    if (!target) return;
    anchor.current = null;
    if (target.fit) space.current.scrollTo(0, 0);
    else
      space.current.scrollTo(
        viewport.current.offsetLeft +
          target.u * viewport.current.offsetWidth -
          target.x,
        viewport.current.offsetTop +
          target.v * viewport.current.offsetHeight -
          target.y,
      );
  });
  const onWheel = useEffectEvent((event) => {
    if (!(event.ctrlKey || event.metaKey) || editing) return;
    event.preventDefault();
    const delta =
      event.deltaY *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? space.current.clientHeight
          : 1);
    setZoom(frame.factor * Math.exp(-delta * 0.002), event);
  });
  useEffect(() => {
    const area = space.current;
    area.addEventListener("wheel", onWheel, { passive: false });
    const observer = new ResizeObserver(() =>
      frame.setArea((previous) =>
        previous.width === area.clientWidth &&
        previous.height === area.clientHeight
          ? previous
          : { width: area.clientWidth, height: area.clientHeight },
      ),
    );
    observer.observe(area);
    return () => {
      area.removeEventListener("wheel", onWheel);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    const release = () => {
      pan.current = null;
      held.current = false;
      setGrabbing(false);
      setHand(false);
    };
    const down = (e) => {
      if (
        e.code === "Space" &&
        !e.target.closest(
          "input,textarea,select,button,a,summary,[role=tab],[contenteditable=true]",
        )
      ) {
        e.preventDefault();
        held.current = true;
        setHand(true);
      }
    };
    const up = (e) => {
      if (e.code === "Space") release();
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    document.addEventListener("pointerup", release);
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
      document.removeEventListener("pointerup", release);
      window.removeEventListener("blur", release);
    };
  }, []);
  return {
    density: frame.density,
    cursor: grabbing ? "grabbing" : hand ? "grab" : undefined,
    startPan(e) {
      if (editing || !(held.current || e.button === 1)) return false;
      e.preventDefault();
      pan.current = {
        x: e.clientX,
        y: e.clientY,
        left: space.current.scrollLeft,
        top: space.current.scrollTop,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      setGrabbing(true);
      return true;
    },
    movePan(e) {
      if (!pan.current) return false;
      space.current.scrollTo(
        pan.current.left + pan.current.x - e.clientX,
        pan.current.top + pan.current.y - e.clientY,
      );
      return true;
    },
    endPan() {
      if (!pan.current) return false;
      pan.current = null;
      setGrabbing(false);
      return true;
    },
  };
}
