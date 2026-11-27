"use client";

import { useState } from "react";

const questions = [
  {
    question: "What is Snoozer?",
    answer: "Snoozer is a link-in-bio platform where you can bring your socials, websites, projects and supported media together on one personal page. Share one Snoozer address instead of sending people all over the internet.",
  },
  {
    question: "Can I use Snoozer for free?",
    answer: "Yes. You can create and publish a free Snoozer page. Plus, Pro and Studio are optional Premium tiers for people who want additional profile, storage and customisation features.",
  },
  {
    question: "What can I put on my profile?",
    answer: "Add social links, websites, profile text, photos and supported widgets. Available media tools and limits depend on your plan. Your public page only shows the content you choose to publish.",
  },
  {
    question: "Can I customise how my page looks?",
    answer: "Yes. Creator Studio lets you work with themes, colours, layouts, backgrounds, effects and profile widgets. You can preview your changes before publishing your page.",
  },
  {
    question: "Is my profile automatically listed in Discover?",
    answer: "No. Creator discovery is opt-in and your directory listing is off by default. You choose whether your profile can appear in public creator discovery; publishing a profile does not switch that setting on.",
  },
  {
    question: "How do Premium plans and cancellations work?",
    answer: "Snoozer Premium offers Plus, Pro and Studio with monthly or yearly billing. You can compare the current features and prices on the Pricing page. Active subscribers can manage their subscription through the account billing tools.",
  },
] as const;

export function HomeFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="home-faq-list" data-reveal="up">
      {questions.map((item, index) => {
        const open = openIndex === index;
        const questionId = "home-faq-question-" + (index + 1);
        const answerId = "home-faq-answer-" + (index + 1);
        return (
          <article className={"home-faq-item" + (open ? " is-open" : "")} key={item.question}>
            <h3>
              <button
                className="home-faq-trigger"
                id={questionId}
                type="button"
                aria-expanded={open}
                aria-controls={answerId}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span>{item.question}</span>
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
                  <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </h3>
            <div
              className="home-faq-answer"
              id={answerId}
              role="region"
              aria-labelledby={questionId}
              aria-hidden={!open}
              inert={!open}
            >
              <div className="home-faq-answer-inner"><p>{item.answer}</p></div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
