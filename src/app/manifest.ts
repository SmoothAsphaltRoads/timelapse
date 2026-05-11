import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Timelapse",
    short_name: "Timelapse",
    description: "Sparse-capture study verification platform",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
