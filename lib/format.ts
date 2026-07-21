export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function statusLabel(status: string) {
  return { RUNNING: "生成中", COMPLETED: "已完成", FAILED: "失败", CANCELLED: "已停止" }[status] ?? status;
}
