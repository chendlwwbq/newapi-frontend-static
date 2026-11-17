export function followsLatestMessage(scrollHeight: number, clientHeight: number, scrollTop: number): boolean {
  return scrollHeight - clientHeight - scrollTop <= 80
}
