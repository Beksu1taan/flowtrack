1. Project Proposal
Project Idea: My project is a "Smart Budget Planner." It’s a web app to help people track their daily income and expenses in one place.

Target Audience: Mainly students and young professionals who want to manage their money better without using complex spreadsheets.

Problem Solved: Many people forget where their money goes by the end of the month. This app helps by visualizing spending habits and showing the current balance.

MVP Features:

Adding and deleting expense records.

Basic categories like Food, Transport, or Fun.

Simple dashboard showing total balance.

2. SPA Theory Questions
What is a Single Page Application (SPA)?
An SPA is a web app that loads only one HTML page. Instead of refreshing the whole page every time you click a link, it just swaps out parts of the content dynamically. It feels much faster, almost like a mobile app, because the browser doesn't have to reload everything from the server constantly.

How does SPA differ from traditional Multi-Page Applications (MPA)?
In a traditional MPA, every time you go to a new page, the browser asks the server for a whole new HTML file, which causes a "blink" or loading screen. In an SPA, we stay on the same page. The app only fetches the data it needs (like JSON) and updates the screen without a full refresh.

What is the Virtual DOM?
The Virtual DOM is like a "draft" or a copy of the real DOM that React keeps in its memory. When something changes in the app, React updates this copy first. Then, it compares the draft with the real page and only changes the specific parts that actually moved or updated. This makes the app perform much better.

Why does React use a component-based architecture?
React uses components because it’s way easier to build a big app by breaking it into small, reusable pieces (like Header, Button, or Footer). It makes the code cleaner and easier to fix. If I need to change the Header, I only edit one file instead of searching through a huge mess of code.