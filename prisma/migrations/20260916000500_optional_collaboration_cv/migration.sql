-- Academic and industry collaboration applications use a proposal instead of a CV.
ALTER TABLE "Application" ALTER COLUMN "cvKey" DROP NOT NULL;
