FROM python:3.10-slim-bullseye

RUN apt-get update

RUN pip install --upgrade pip

RUN apt-get install -y build-essential cmake libjpeg-dev libpng-dev

WORKDIR app
COPY static static
COPY templates templates
COPY main.py main.py
COPY controller.py controller.py
COPY processvideos.py processvideos.py
COPY ./requirements.txt requirements.txt
COPY config config
RUN mkdir data


RUN pip install -r requirements.txt

ENTRYPOINT ["python", "-u", "main.py"]
