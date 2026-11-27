"use client";

import { useState } from "react";
import type { AccountLocale } from "@/lib/account-locale";
import { homeContent } from "@/lib/home-translations";

export function HomeFaq({ locale = "en-US" }: { locale?: AccountLocale }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const questions = homeContent(locale).faq.items;

  return (
    <div className="home-faq-list" data-reveal="up">
      {questions.map((item, index) => {
        const open = openIndex === index;
        const questionId = "home-faq-question-" + (index + 1);
        const answerId = "home-faq-answer-" + (index + 1);
        return (
          <article className={"home-faq-item" + (open ? " is-open" : "")} key={questionId}>
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
