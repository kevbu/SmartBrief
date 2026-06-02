export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundRefresh } = await import('./lib/scheduler')
    startBackgroundRefresh()
  }
}
