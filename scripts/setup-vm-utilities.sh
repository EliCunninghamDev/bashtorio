#!/bin/sh
# Run this script INSIDE the VM to set up custom utilities
# After running, use window.bashtorio.downloadState() in browser console to save

# Create cowsay
cat > /usr/local/bin/cowsay << 'COWSAY'
#!/bin/sh
msg="${*:-$(cat)}"
len=${#msg}
border=$(printf "%*s" "$((len + 2))" "" | tr " " "-")
echo " $border"
echo "< $msg >"
echo " $border"
echo "        \\   ^__^"
echo "         \\  (oo)\\_______"
echo "            (__)\\       )\\/\\"
echo "                ||----w |"
echo "                ||     ||"
COWSAY
chmod +x /usr/local/bin/cowsay
ln -sf cowsay /usr/local/bin/cowthink

# Create fortune
cat > /usr/local/bin/fortune << 'FORTUNE'
#!/bin/sh
fortunes="Stay hungry, stay foolish.
Simplicity is the ultimate sophistication.
Be yourself; everyone else is taken.
Talk is cheap. Show me the code.
First, solve the problem. Then, write the code.
The only way to do great work is to love what you do.
In the middle of difficulty lies opportunity.
Life is what happens while you are busy making other plans.
Unix is user-friendly. It's just selective about who its friends are.
There are only 10 types of people: those who understand binary and those who don't."
echo "$fortunes" | shuf -n1
FORTUNE
chmod +x /usr/local/bin/fortune

# Create lolcat (simple color cycler)
cat > /usr/local/bin/lolcat << 'LOLCAT'
#!/bin/sh
i=0
while IFS= read -r line || [ -n "$line" ]; do
  color=$((31 + (i % 6)))
  printf '\033[%dm%s\033[0m\n' "$color" "$line"
  i=$((i + 1))
done
LOLCAT
chmod +x /usr/local/bin/lolcat

# Create banner (simple)
cat > /usr/local/bin/banner << 'BANNER'
#!/bin/sh
msg="${*:-$(cat)}"
len=${#msg}
border=$(printf "%*s" "$((len + 4))" "" | tr " " "#")
echo "$border"
echo "# $msg #"
echo "$border"
BANNER
chmod +x /usr/local/bin/banner

echo "Utilities installed: cowsay, fortune, lolcat, banner"
echo "Test with: fortune | cowsay"
