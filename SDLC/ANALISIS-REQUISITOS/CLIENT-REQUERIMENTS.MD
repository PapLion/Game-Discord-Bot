Goal:
Build a Discord bot that runs multiple game types and automatically sends winners a DM that contains their prize (reward details) after each game.

🧠 Core Requirements

Support multiple games (like Roblox-style variety)

Players join and compete in real time

Track scores, winners, and participation

When a player wins:

The bot sends a Direct Message (DM)

The DM must include their prize/reward

The system should feel like a full game platform

🏆 DM Prize System (IMPORTANT)

Each winner must receive a DM like:

🎉 You Won!
🏆 Game: Trivia Challenge
💰 Prize: 100 Coins
🎁 Reward: Rare Badge

Your prize has been added to your account!

If DMs fail:

Send the same message in the server instead

🎯 Prize Types

Prizes included in DMs can be:

Coins / points

Virtual items

Roles (Discord perks)

Badges

Access to special games

Redeem codes (if external rewards exist)

🎲 Game Types

Include multiple mini-games:

Trivia

Reaction speed games

Word puzzles

Math challenges

Luck-based games (dice, spin wheel)

Guessing games

Elimination games

💬 Commands

!join → join game

!start → start game (admin only)

!play → participate

!score → check points

!leaderboard → view rankings

!reward → trigger prize system

💻 Technical Requirements

Must be built for Discord

Use a database to store:

user scores

inventory/prizes

Support multiple players at once

Handle errors (especially DM failures)

Be scalable for new games

🔥 Extra Features

Daily rewards

Streak bonuses

Random prize drops

Admin-controlled rewards

Custom game creation

Anti-cheat / cooldowns

⚠️ Important Note

The bot cannot send physical prizes directly

Instead, it sends prize information inside DMs

Real prizes must be handled manually or via external