"use client";
import SidebarLayout from "../components/SidebarLayout";

const Downloads = () => {
  return (
    <SidebarLayout>
      <div className="flex flex-col items-center justify-center px-8 py-12">
        <div className="flex flex-col items-start space-y-8 max-w-4xl w-full">
          <div className="flex flex-col items-start space-y-6 w-full">
            <h1 className="text-white text-3xl font-bold">Americas Army 2.3 Download</h1>
            <p className="text-white text-lg leading-relaxed">
              There's some experimenting with non AA2.5 versions. One version we're doing this with is 2.3. Download the base game and required patches to get started.
            </p>
          </div>

          <div className="w-full max-w-4xl">
            <div className="flex flex-col gap-4">
              <a
                href="https://pub-9122f2b1974a4070a1e48b604f43cd00.r2.dev/AmericasArmy220_NVIDIA.exe"
                className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:bg-gray-800 transition-colors"
              >
                <div className="text-white font-semibold mb-1">Americas Army 2.2</div>
                <div className="text-gray-400 text-sm mb-2">Base Game</div>
                <div className="text-gray-500 text-xs font-mono break-all">SHA256: 401a8939e377540b4817090661e3cc2004d6f6bf68a915f24ab8da7b42fe0916</div>
              </a>
              <a
                href="https://pub-9122f2b1974a4070a1e48b604f43cd00.r2.dev/aao_patch_220to221.zip"
                className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:bg-gray-800 transition-colors"
              >
                <div className="text-white font-semibold mb-1">Patch 2.2 → 2.2.1</div>
                <div className="text-gray-400 text-sm mb-2">Update Patch</div>
                <div className="text-gray-500 text-xs font-mono break-all">SHA256: dc2752bbde52c53dda3879c86b0b85c4ddca95ba750d004476b29d6afd4da9ab</div>
              </a>
              <a
                href="https://pub-9122f2b1974a4070a1e48b604f43cd00.r2.dev/aao_patch_221to230.zip"
                className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:bg-gray-800 transition-colors"
              >
                <div className="text-white font-semibold mb-1">Patch 2.2.1 → 2.3</div>
                <div className="text-gray-400 text-sm mb-2">Update Patch</div>
                <div className="text-gray-500 text-xs font-mono break-all">SHA256: 6370fb7fa06bd0a8da46bfd1c8d1ef9ffe77b8cb56ca265c1fa39cc92c85baf0</div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default Downloads;

