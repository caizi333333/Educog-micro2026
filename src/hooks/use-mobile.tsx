import * as React from "react"

const MOBILE_BREAKPOINT = 768

// This is the key: we default to a non-mobile view, which is consistent on server and client.
// The effect then runs on the client to update to the correct value.
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const check = () => setIsMobile(mql.matches)
    
    // Check on mount
    check()
    
    // Listen for changes
    mql.addEventListener("change", check)
    
    return () => mql.removeEventListener("change", check)
  }, [])

  return isMobile
}
