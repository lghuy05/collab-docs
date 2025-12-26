import { Button } from "@/components/ui/button";
import Link from "next/link";

const Home = () => {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Link href="/documents/1">
        <span className="text-blue-500 underline">Click me</span> to go to document
      </Link>
    </div>
  );
}
export default Home;
