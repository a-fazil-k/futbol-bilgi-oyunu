{ pkgs ? import <nixpkgs> {} }:

let
  python = pkgs.python3.withPackages (pythonPackages: with pythonPackages; [
    lxml
    requests
  ]);
in
pkgs.mkShell {
  packages = with pkgs; [
    nodejs_22
    python
    pkg-config
    sqlite
    stdenv.cc
  ];

  shellHook = ''
    echo "Node.js: $(node --version)"
    echo "Python:  $(python --version)"
    echo "Run 'npm install' to install project packages."
  '';
}
