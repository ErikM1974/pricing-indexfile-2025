"""Join value-continuation lines (a gradient list wrapped onto the next line) onto their declaration line
so the tokenizer's ':'-guard sees them. Usage: join-continuations.py file:line[,line...] ..."""
import sys

for arg in sys.argv[1:]:
    path, nums = arg.split(':')
    lines_to_join = sorted({int(n) for n in nums.split(',')}, reverse=True)
    with open(path, 'rb') as fh:
        raw = fh.read()
    nl = b'\r\n' if b'\r\n' in raw else b'\n'
    lines = raw.split(nl)
    for n in lines_to_join:
        i = n - 1
        cur = lines[i].lstrip()
        prev = lines[i - 1].rstrip()
        lines[i - 1] = prev + b' ' + cur
        del lines[i]
    with open(path, 'wb') as fh:
        fh.write(nl.join(lines))
    print(f'{path}: joined {len(lines_to_join)} continuation line(s)')
