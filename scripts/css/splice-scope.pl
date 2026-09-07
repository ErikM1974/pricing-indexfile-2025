# Splice a block of scope lines (file given as ARGV[0]) into scripts/lint-css.js just before the array's closing "];".
use strict; use warnings;
my ($block_file) = @ARGV;
open(my $b, '<', $block_file) or die $!; local $/; my $add = <$b>; close $b;
my $f = 'scripts/lint-css.js';
open(my $h, '<', $f) or die $!; binmode $h; my $c = <$h>; close $h;
$add =~ s/\r?\n/\r\n/g;
$c =~ s/(\r?\n)\];(\r?\n)(\r?\n)async function run/$1$add\];$2$3async function run/ or die 'anchor not found';
open(my $o, '>', $f) or die $!; binmode $o; print $o $c; close $o;
print "spliced\n";
