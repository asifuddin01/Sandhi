export function SandhiFieldPoster() {
  return (
    <svg
      className="sandhi-field-poster"
      viewBox="0 0 1440 860"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-labelledby="sandhi-field-title sandhi-field-description"
    >
      <title id="sandhi-field-title">The Sandhi Field</title>
      <desc id="sandhi-field-description">
        Fine threads from two directions meet at a single junction.
      </desc>

      <g className="sandhi-field-poster__quiet-lines">
        <path d="M-60 178C208 144 346 255 554 340C714 405 806 413 957 362C1114 308 1250 206 1500 238" />
        <path d="M-50 648C234 694 368 569 558 485C718 414 806 403 953 442C1118 486 1266 637 1490 602" />
        <path d="M-70 282C214 248 351 302 539 378C708 446 821 455 970 400C1149 334 1261 303 1504 330" />
        <path d="M-40 554C233 596 367 534 548 462C717 395 820 389 968 430C1131 476 1270 553 1492 526" />
      </g>

      <g className="sandhi-field-poster__active-lines">
        <path d="M338 178C510 236 606 351 744 420" />
        <path d="M352 670C506 603 608 495 744 420" />
        <path d="M1116 195C961 246 872 355 744 420" />
        <path d="M1097 657C952 590 871 487 744 420" />
      </g>

      <g className="sandhi-field-poster__motion-traces" aria-hidden="true">
        <path
          pathLength="1000"
          d="M-60 178C208 144 346 255 554 340C714 405 806 413 957 362C1114 308 1250 206 1500 238"
        />
        <path
          pathLength="1000"
          d="M-50 648C234 694 368 569 558 485C718 414 806 403 953 442C1118 486 1266 637 1490 602"
        />
        <path
          pathLength="1000"
          d="M-70 282C214 248 351 302 539 378C708 446 821 455 970 400C1149 334 1261 303 1504 330"
        />
        <path
          pathLength="1000"
          d="M-40 554C233 596 367 534 548 462C717 395 820 389 968 430C1131 476 1270 553 1492 526"
        />
      </g>

      <g className="sandhi-field-poster__points">
        <circle cx="130" cy="205" r="2" />
        <circle cx="222" cy="247" r="1.7" />
        <circle cx="315" cy="301" r="2.2" />
        <circle cx="409" cy="345" r="1.5" />
        <circle cx="504" cy="381" r="2" />
        <circle cx="590" cy="405" r="1.5" />
        <circle cx="899" cy="386" r="2" />
        <circle cx="994" cy="342" r="1.5" />
        <circle cx="1094" cy="298" r="2.2" />
        <circle cx="1200" cy="262" r="1.7" />
        <circle cx="1304" cy="244" r="2" />
        <circle cx="148" cy="624" r="2" />
        <circle cx="240" cy="587" r="1.7" />
        <circle cx="333" cy="543" r="2.2" />
        <circle cx="426" cy="501" r="1.5" />
        <circle cx="517" cy="467" r="2" />
        <circle cx="604" cy="441" r="1.5" />
        <circle cx="891" cy="454" r="2" />
        <circle cx="982" cy="492" r="1.5" />
        <circle cx="1080" cy="533" r="2.2" />
        <circle cx="1190" cy="571" r="1.7" />
        <circle cx="1300" cy="595" r="2" />
      </g>

      <g className="sandhi-field-poster__junction">
        <circle cx="744" cy="420" r="3" />
        <circle
          className="sandhi-field-poster__junction-ring"
          cx="744"
          cy="420"
          r="9"
        />
      </g>
    </svg>
  );
}
