import shutil
from wp_sql_dump import WikipediaSqlDump, WikipediaSqlCsvDialect
import os
import requests
import subprocess
import io
import csv
import json


class SetEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, set):
            return list(obj)
        return json.JSONEncoder.default(self, obj)


pageColumns = ["page_id", "page_title"]
pagelinksColumns = ["pl_from", "pl_title"]
redirectColumns = ["rd_from", "rd_title"]

pageAllowlist = {'page_namespace': "0"}
pagelinkAllowlist = {"pl_namespace": "0", "pl_from_namespace": "0"}
redirectAllowlist = {'rd_namespace': "0"}


def run_sort_command(input_file, output_file):
    script_path = 'sort_script.sh'  # Replace with the actual path to your Bash script
    try:
        subprocess.run(["bash", script_path, input_file, output_file], check=True)
        print("Bash sort executed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error executing Bash script. Return code: {e.returncode}")


# Unused for now, maybe for MongoDB shit
def process_and_groupJSON(input_file, output_file):
    ALL_PAGE_IDS = set()
    PAGE_IDS_TO_TITLES = {}
    PAGES_FILE = "enwiki-20231122-page_no_empty_lines.csv"
    for line in io.open(PAGES_FILE, 'r', encoding='utf-8'):
        [page_id, page_title] = line.rstrip('\n').split(',', 1)
        ALL_PAGE_IDS.add(page_id)
        PAGE_IDS_TO_TITLES[page_id] = page_title
    with open(input_file, 'r', newline='', encoding='utf-8') as infile, \
            open(output_file, 'w', encoding='utf-8') as outfile:

        reader = csv.reader(infile, delimiter='\t')
        # writer = csv.writer(outfile, delimiter='\t')

        current_first_column = None
        current_values = set()
        output_data = []

        entry_count = 0  # Variable to keep track of the number of entries
        # Initialize the output file with the new key
        outfile.write('{"' + "pages" + '": ')

        for row in reader:
            if len(row) < 2:
                continue  # Skip lines with less than two columns

            first_column, second_column = row[0], row[1]

            if current_first_column is None:
                current_first_column = first_column

            # Check if the first column changes
            if first_column != current_first_column:
                page_title = PAGE_IDS_TO_TITLES.get(first_column).replace("_", " ")

                if entry_count > 1000:
                    json.dump(output_data, outfile, indent=2, cls=SetEncoder, ensure_ascii=False)
                    output_data = [{
                        "page_id": current_first_column,
                        "page_title": page_title,
                        "child_ids": current_values
                    }]
                    entry_count = 0
                else:
                    # Add the result to the list
                    output_data.append({
                        "page_id": current_first_column,
                        "page_title": page_title,
                        "child_ids": current_values
                    })
                    entry_count += 1

                # Reset for the new group
                current_first_column = first_column
                current_values = set()
            if second_column != first_column:
                current_values.add(second_column)

        # Write the last group
        if current_first_column is not None:
            page_title = PAGE_IDS_TO_TITLES.get(first_column)
            output_data.append({
                "page_id": current_first_column,
                "page_title": page_title,
                "child_ids": current_values
            })
        # Write the data to the JSON file
        json.dump(output_data, outfile, indent=2, cls=SetEncoder, ensure_ascii=False)
        # Close the output file
        outfile.write('}')


def process_and_group(pagefile, input_file, output_pagelinks, output_pagefile):
    ALL_PAGE_IDS = set()
    PAGE_IDS_TO_TITLES = {}
    for line in io.open(pagefile, 'r', encoding='utf-8'):
        [page_id, page_title] = line.rstrip('\n').split(',', 1)
        ALL_PAGE_IDS.add(page_id)
        PAGE_IDS_TO_TITLES[page_id] = page_title
    with open(input_file, 'r', newline='', encoding='utf-8') as infile, \
            open(output_pagelinks, 'w', newline='', encoding='utf-8') as outfile, \
            open(output_pagefile, 'w', newline='', encoding='utf-8') as new_pagefile_out:

        reader = csv.reader(infile, delimiter=',')
        writer = csv.writer(outfile, delimiter='\t')
        new_pagefile_writer = csv.writer(new_pagefile_out, delimiter='\t')

        current_first_column = None
        current_values = set()
        buffer = []
        buffer_size = 500

        for row in reader:
            if len(row) < 2:
                continue  # Skip lines with less than two columns

            first_column, second_column = row[0], row[1]

            if current_first_column is None:
                current_first_column = first_column

            # Check if the first column changes
            if first_column != current_first_column:
                page_title = PAGE_IDS_TO_TITLES.get(current_first_column)  # .replace("_", " ")
                current_values_str = '{{{}}}'.format(','.join(current_values))
                #buffer.append([current_first_column, page_title, current_values_str])
                buffer.append([current_first_column, current_values_str])

                # Write to the file after every 100 lines
                if len(buffer) >= buffer_size:
                    writer.writerows(buffer)
                    buffer = []

                # Write to the new_pagefile
                num_children = len(current_values)
                new_pagefile_writer.writerow([current_first_column, page_title, num_children])

                # Reset for the new group
                current_first_column = first_column
                current_values = set()

            if second_column != first_column:
                current_values.add(second_column)

        # Write the remaining rows in the buffer
        if buffer:
            writer.writerows(buffer)

        # Write the last group
        if current_first_column is not None:
            page_title = PAGE_IDS_TO_TITLES.get(first_column)
            num_children = len(current_values)
            writer.writerow([current_first_column, '{{{}}}'.format(','.join(current_values))])
            new_pagefile_writer.writerow([current_first_column, page_title, num_children])


def emptyLineRemover(inputfile, outputfile):
    with open(inputfile, 'r', encoding='utf-8') as infile, open(outputfile, 'w', newline='',
                                                                encoding='utf-8') as outfile:
        # Iterate through each line in the input file
        for line in infile:
            # Check if the line is not empty (contains at least one non-whitespace character)
            if line.strip():
                # Write non-empty lines to the output file
                outfile.write(line)


def clean_redirects(page_file, redirect_file, output_file_path):
    # Create a set of all page IDs and a dictionary of page titles to their corresponding IDs.
    ALL_PAGE_IDS = set()
    PAGE_TITLES_TO_IDS = {}

    for line in io.open(page_file, 'r', encoding='utf-8'):
        [page_id, page_title] = line.rstrip('\n').split(',', 1)
        ALL_PAGE_IDS.add(page_id)
        PAGE_TITLES_TO_IDS[page_title] = page_id

    # Create a dictionary of redirects, replace page titles in the redirects file with their
    # corresponding IDs and ignoring pages which do not exist.
    REDIRECTS = {}
    for line in io.open(redirect_file, 'r', encoding='utf-8'):
        if line.strip():
            [source_page_id, target_page_title] = line.rstrip('\n').split(',', 1)

            source_page_exists = source_page_id in ALL_PAGE_IDS
            target_page_id = PAGE_TITLES_TO_IDS.get(target_page_title)

            if source_page_exists and target_page_id is not None:
                REDIRECTS[source_page_id] = target_page_id

    with open(output_file_path, 'w', newline='', encoding='utf-8') as output_file:
        csv_writer = csv.writer(output_file, delimiter=',')
        output_buffer = []
        # Loop through the redirects dictionary and remove redirects which redirect to another redirect,
        # writing the remaining redirects to stdout.
        for source_page_id, target_page_id in REDIRECTS.items():
            start_target_page_id = target_page_id

            redirected_count = 0
            while target_page_id in REDIRECTS:
                target_page_id = REDIRECTS[target_page_id]

                redirected_count += 1

                # Break out if there is a circular path, meaning the redirects only point to other redirects,
                # not an actual page.
                if target_page_id == start_target_page_id or redirected_count > 100:
                    target_page_id = None

            if target_page_id is not None:
                output_buffer.extend([(source_page_id, target_page_id)])
        # print(output_buffer)
        csv_writer.writerows(output_buffer)


def process_csv_files(output_file_path, page_file_path, pagelinks_file_path, redirects_file_path):
    # Create a set of all page IDs and a dictionary of page titles to their corresponding IDs.
    ALL_PAGE_IDS = set()
    PAGE_TITLES_TO_IDS = {}

    for line in io.open(page_file_path, 'r', encoding='utf-8'):
        [page_id, page_title] = line.rstrip('\n').split(',', 1)
        ALL_PAGE_IDS.add(page_id)
        PAGE_TITLES_TO_IDS[page_title] = page_id

    # Create a dictionary of page IDs to the target page ID to which they redirect.
    REDIRECTS = {}
    for line in io.open(redirects_file_path, 'r', encoding='utf-8'):
        if line.strip():
            [source_page_id, target_page_id] = line.rstrip('\n').split(',', 1)
            REDIRECTS[source_page_id] = target_page_id

    output_batch_size = 1000  # Adjust this based on your system's I/O characteristics
    # Loop through each line in the links file, replacing titles with IDs, applying redirects, and
    # removing nonexistent pages, writing the result to stdout.
    with open(output_file_path, 'w', newline='', encoding='utf-8') as output_file:
        csv_writer = csv.writer(output_file, delimiter=',')
        output_buffer = []

        for line in io.open(pagelinks_file_path, 'r', encoding='utf-8'):
            if line.strip():

                # csv_writer = csv.writer(output_file, delimiter='\t')
                [source_page_id, target_page_title] = line.rstrip('\n').split(',', 1)

                source_page_exists = source_page_id in ALL_PAGE_IDS

                if source_page_exists:
                    source_page_id = REDIRECTS.get(source_page_id, source_page_id)

                    target_page_id = PAGE_TITLES_TO_IDS.get(target_page_title)

                    if target_page_id is not None and source_page_id != target_page_id:
                        target_page_id = REDIRECTS.get(target_page_id, target_page_id)
                        output_buffer.extend([(source_page_id, target_page_id)])

                        if len(output_buffer) >= output_batch_size:
                            csv_writer.writerows(output_buffer)
                            output_buffer = []

        # Write the output to the CSV file
        csv_writer.writerows(output_buffer)


def download_file(url, filename):
    with requests.get(url, stream=True) as response:
        response.raise_for_status()  # Check for errors

        with open(filename, 'wb') as file:
            shutil.copyfileobj(response.raw, file)


def downloadAndCheckFile(file_name, download_url, columns2keep, allowDict, processedFilename):
    if not os.path.exists(processedFilename):
        # Check if the file already exists in the current folder
        if os.path.exists(file_name):
            print(f"The file {file_name} already downloaded, starting CSV process.")
            # for page file = page_is_redirect A value of 1 here indicates the article is a redirect; it is 0 in all other cases.
            print(f"{processedFilename} does not exist")
            print(f"Creating {processedFilename}")
            wsd = WikipediaSqlDump(file_name, columns2keep, allowDict)
            wsd.to_csv()
        else:
            print(f"The file {file_name} does not exist. Downloading...")
            download_file(download_url, file_name)
            print(f"Download complete for {file_name}")
            downloadAndCheckFile(file_name, download_url, columns2keep, allowDict, processedFilename)
    else:
        print(f"The file {processedFilename} exists already, proceeding to the next step")


def process_file(file_path, action_description, *args):
    if not os.path.exists(file_path):
        print(f"{file_path} does not exist")
        print(f"{action_description} and creating {file_path}")
        args[0](*args[1:])


page_orig = "enwiki-latest-page.csv"
page_clean = "enwiki-latest-page_CLEAN.csv"
page_final = "enwiki-latest-page_FINAL.csv"

pagelinks = "enwiki-latest-pagelinks.csv"
pagelinks_replaced = "enwiki-latest-pagelinks_REPLACED.csv"
pagelinks_cleaned_up = "enwiki-latest-pagelinks_CLEANED_UP_W_Redirects.csv"
pagelinks_sorted = "enwiki-latest-pagelinks_SORTED.csv"
pagelinks_final = "enwiki-latest-pagelinks_FINAL.csv"

redirect_orig = "enwiki-latest-redirect.csv"
redirect_final = "enwiki-latest-redirect_CLEANED.csv"


def main():
    downloadAndCheckFile("enwiki-latest-page.sql.gz",
                         "https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-page.sql.gz", pageColumns,
                         pageAllowlist, page_orig)
    downloadAndCheckFile("enwiki-latest-pagelinks.sql.gz",
                         "https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pagelinks.sql.gz",
                         pagelinksColumns, pagelinkAllowlist, pagelinks)
    downloadAndCheckFile("enwiki-latest-redirect.sql.gz",
                         "https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-redirect.sql.gz",
                         redirectColumns, redirectAllowlist, redirect_orig)
    # TODO if you want this to go much quciker change from gz to sql in the 2 line above and extract the sql files manually (preferable)

    process_file(page_clean, "Removing empty lines", emptyLineRemover, page_orig, page_clean)
    process_file(redirect_final, "Replacing redirected links in redirect file", clean_redirects, page_clean,
                 redirect_orig, redirect_final)
    process_file(pagelinks_replaced, "Replacing titles and redirected links in pagelinks file", process_csv_files,
                 pagelinks_replaced, page_clean, pagelinks, redirect_final)
    process_file(pagelinks_sorted, "Sorting pagelinks file", run_sort_command, pagelinks_replaced, pagelinks_sorted)
    process_file(pagelinks_final, "Grouping pagelinks file and fixing page file for final output", process_and_group,
                 page_clean, pagelinks_sorted, pagelinks_final, page_final)


main()
