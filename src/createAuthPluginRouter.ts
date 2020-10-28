import express, { Router } from "express";
import { Authenticator } from "passport";
import { default as ApiClient } from "@magda/auth-api-client";
import { Strategy as LocalStrategy } from "passport-local";
import loginToCkan from "./loginToCkan";
import {
    createOrGetUserToken,
    redirectOnSuccess,
    redirectOnError,
    getAbsoluteUrl
} from "@magda/authentication-plugin-sdk";

export interface AuthPluginRouterOptions {
    authorizationApi: ApiClient;
    passport: Authenticator;
    externalUrl: string;
    authPluginRedirectUrl: string;
    // ckan site base url
    ckanUrl: string;
}

export default function createAuthPluginRouter(
    options: AuthPluginRouterOptions
): Router {
    const authorizationApi = options.authorizationApi;
    const passport = options.passport;
    const ckanUrl = options.ckanUrl;
    const externalUrl = options.externalUrl;
    const resultRedirectionUrl = getAbsoluteUrl(
        options.authPluginRedirectUrl,
        externalUrl
    );

    if (!ckanUrl) {
        throw new Error("Required parameter ckanUrl can't be empty!");
    }

    const router: express.Router = express.Router();

    passport.use(
        "ckan-local",
        new LocalStrategy(function (
            username: string,
            password: string,
            cb: (error: any, user?: any, info?: any) => void
        ) {
            loginToCkan(username, password, ckanUrl).then((result) => {
                result.caseOf({
                    left: (error) => cb(error),
                    right: (profile) => {
                        createOrGetUserToken(authorizationApi, profile, "ckan")
                            .then((userId) => cb(null, userId))
                            .catch((error) => cb(error));
                    }
                });
            });
        })
    );

    router.get("/", function (req, res) {
        res.render("form");
    });

    router.post(
        "/",
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            passport.authenticate("ckan-local", {
                failWithError: true
            })(req, res, next);
        },
        (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            redirectOnSuccess(resultRedirectionUrl, req, res);
        },
        (
            err: any,
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ): any => {
            redirectOnError(err, resultRedirectionUrl, req, res);
        }
    );

    return router;
}
