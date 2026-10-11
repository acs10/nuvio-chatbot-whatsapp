import { enableStaticRendering } from "mobx-react-lite";

// No servidor os observers renderizam uma única vez, sem criar reações.
enableStaticRendering(typeof window === "undefined");

export { observer } from "mobx-react-lite";
