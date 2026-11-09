#!/bin/zsh
# 用法：./sheet.sh <feature-id> → 在输出目录生成 <id>-sheet.jpg（等间隔 6 帧，3×2），用于快速检查画面。
dir=${MCX_DEMO_OUT:-docs/verification/previews}; f=$dir/$1.mp4
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $f)
ffmpeg -v error -y -i $f -vf "fps=6/$d,scale=360:-2,tile=3x2" -frames:v 1 $dir/$1-sheet.jpg && echo "$1: ${d}s → $dir/$1-sheet.jpg"
