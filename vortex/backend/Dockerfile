# Stage 1: Build
FROM maven:3.9.8-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Run
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/backend-0.0.1-SNAPSHOT.jar app.jar

# Create directory for SQLite and Chroma blobs
RUN mkdir -p /app/data

EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]