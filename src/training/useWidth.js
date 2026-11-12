import { onMounted, onUnmounted, ref } from "vue";

/** Width of an element, kept current with a ResizeObserver. 0 until mounted. */
export function useWidth() {
  const el = ref(null);
  const width = ref(0);
  let ro = null;
  onMounted(() => {
    const read = () => {
      const w = Math.round(el.value?.clientWidth || 0);
      if (w && w !== width.value) width.value = w;
    };
    ro = new ResizeObserver(read);
    if (el.value) ro.observe(el.value);
    read();
  });
  onUnmounted(() => ro?.disconnect());
  return { el, width };
}
