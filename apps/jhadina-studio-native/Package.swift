// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "JhadinaStudioNative",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(name: "JhadinaStudioNative", targets: ["JhadinaStudioNative"])
    ],
    dependencies: [
        .package(url: "https://github.com/BradLarson/GPUImage2.git", branch: "master")
    ],
    targets: [
        .target(
            name: "JhadinaStudioNative",
            dependencies: [
                .product(name: "GPUImage", package: "GPUImage2")
            ]
        )
    ]
)
