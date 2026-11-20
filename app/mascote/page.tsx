import type { Metadata } from "next";
import RobotDemo from "@/components/mascot/RobotDemo";

export const metadata: Metadata = {
  title: "Artigen AI Assistant — Mascote 3D",
  description:
    "Demonstração interativa do mascote 3D oficial do Artigen modelado em Three.js com animações procedurais em tempo real.",
};

export default function MascotePage() {
  return <RobotDemo />;
}
