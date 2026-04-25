[working-directory('library')]
build:
    tsc
    esbuild --bundle src/bundles/datastar.ts  --outdir=../bundles/ --minify --sourcemap --target=es2023 --format=esm
