STACK_NAME = financial-scraper
BUCKET_NAME = financial-scraper-deployment
REGION = us-east-1

.PHONY: build package deploy create-bucket

build:
	cd .. && npm run build

package:
	rm -rf .aws-sam && mkdir .aws-sam && \
	cp ../package.json ../dist && \
	cp ../package-lock.json ../dist && \
	cd ../dist && npm ci --omit=dev

create-bucket:
	aws s3api create-bucket \
	--bucket $(BUCKET_NAME) \
	--region $(REGION)

deploy: build package
	aws cloudformation package \
	--template-file template.yml \
	--s3-bucket $(BUCKET_NAME) \
	--output-template-file .aws-sam/packaged.yml
	aws cloudformation deploy \
	--template-file .aws-sam/packaged.yml \
	--stack-name $(STACK_NAME) \
	--capabilities CAPABILITY_IAM \
	--parameter-overrides \
	BankUsername='$(BANK_USERNAME)' \
	BankPassword='$(BANK_PASSWORD)' \
	GoogleServiceAccountEmail='$(GOOGLE_SERVICE_ACCOUNT_EMAIL)' \
	GooglePrivateKey='$(GOOGLE_PRIVATE_KEY)' \
	GoogleSpreadsheetId='$(GOOGLE_SPREADSHEET_ID)'
